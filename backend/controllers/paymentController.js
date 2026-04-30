const crypto = require("crypto");
const Razorpay = require("razorpay");

const Ride = require("../models/Ride");

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

const APP_SCHEME = process.env.APP_SCHEME || "ridescout";

const ensureRazorpayConfigured = (res) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    res.status(500).json({
      message: "Razorpay is not configured on the server",
    });
    return false;
  }

  return true;
};

const createOrder = async (req, res) => {
  try {
    if (!ensureRazorpayConfigured(res)) return;

    const { amount, currency = "INR", rideId } = req.body;

    if (!amount || !rideId) {
      return res.status(400).json({
        message: "amount and rideId are required",
      });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (
      req.user?.role === "passenger" &&
      String(ride.passengerId) !== String(req.user.userId)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const amountInPaise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: `ride-${rideId}-${Date.now()}`,
      notes: {
        rideId: String(rideId),
        userId: String(req.user?.userId || ""),
      },
    });

    ride.paymentOrderId = order.id;
    ride.paymentStatus = "pending";
    ride.paymentFailureReason = null;
    await ride.save();

    const checkoutUrl =
      `${req.protocol}://${req.get("host")}/api/payments/checkout?` +
      new URLSearchParams({
        orderId: order.id,
        rideId: String(rideId),
        amount: String(amountInPaise),
        currency,
      }).toString();

    return res.status(201).json({
      orderId: order.id,
      amount: amountInPaise,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      checkoutUrl,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Could not create payment order",
      error: error.message,
    });
  }
};

const renderCheckoutPage = async (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(500).send("Razorpay key is missing");
  }

  const { orderId, rideId, amount, currency = "INR" } = req.query;
  if (!orderId || !rideId || !amount) {
    return res.status(400).send("Missing payment details");
  }

  const successUrl = `${APP_SCHEME}://payment-callback`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RideScout Payment</title>
        <style>
          body { font-family: Arial, sans-serif; background: #081018; color: #fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
          .card { background:#fff; color:#081018; padding:24px; width:min(92vw,420px); border-radius:18px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,.25);}
          .btn { background:#0FA958; color:#081018; border:0; border-radius:12px; padding:14px 18px; font-weight:700; width:100%; cursor:pointer; }
          .muted { color:#6D685D; margin-top:10px; font-size:14px; }
        </style>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body>
        <div class="card">
          <h2>Complete your payment</h2>
          <p class="muted">Ride ID: ${rideId}</p>
          <p class="muted">Amount: ${(Number(amount) / 100).toFixed(2)} ${currency}</p>
          <button class="btn" id="pay-btn">Pay with Razorpay</button>
        </div>
        <script>
          async function verifyPayment(payload) {
            const response = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rideId: '${rideId}',
                orderId: '${orderId}',
                razorpay_payment_id: payload.razorpay_payment_id,
                razorpay_order_id: payload.razorpay_order_id,
                razorpay_signature: payload.razorpay_signature
              })
            });
            return response.json();
          }

          function redirectWithStatus(params) {
            const query = new URLSearchParams(params).toString();
            window.location.href = '${successUrl}?' + query;
          }

          const options = {
            key: '${process.env.RAZORPAY_KEY_ID}',
            amount: ${Number(amount)},
            currency: '${currency}',
            name: 'RideScout',
            description: 'Ride payment',
            order_id: '${orderId}',
            handler: async function (response) {
              try {
                const result = await verifyPayment(response);
                if (result.success) {
                  redirectWithStatus({
                    status: 'success',
                    rideId: '${rideId}',
                    paymentId: response.razorpay_payment_id
                  });
                  return;
                }
                redirectWithStatus({
                  status: 'failure',
                  rideId: '${rideId}',
                  reason: result.message || 'Verification failed'
                });
              } catch (error) {
                redirectWithStatus({
                  status: 'failure',
                  rideId: '${rideId}',
                  reason: error.message || 'Verification failed'
                });
              }
            },
            modal: {
              ondismiss: function () {
                redirectWithStatus({
                  status: 'failure',
                  rideId: '${rideId}',
                  reason: 'Payment cancelled'
                });
              }
            },
            theme: {
              color: '#0FA958'
            }
          };

          document.getElementById('pay-btn').addEventListener('click', function () {
            const razorpay = new Razorpay(options);
            razorpay.on('payment.failed', function (response) {
              redirectWithStatus({
                status: 'failure',
                rideId: '${rideId}',
                reason: response.error.description || 'Payment failed'
              });
            });
            razorpay.open();
          });
        </script>
      </body>
    </html>
  `;

  return res.status(200).send(html);
};

const verifyPayment = async (req, res) => {
  try {
    if (!ensureRazorpayConfigured(res)) return;

    const {
      rideId,
      orderId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    if (
      !rideId ||
      !orderId ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({ message: "Missing verification fields" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      ride.paymentStatus = "failed";
      ride.paymentFailureReason = "Signature mismatch";
      await ride.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    ride.paymentStatus = "paid";
    ride.paymentOrderId = orderId;
    ride.paymentId = razorpay_payment_id;
    ride.paymentSignature = razorpay_signature;
    ride.paymentFailureReason = null;
    await ride.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Could not verify payment",
      error: error.message,
    });
  }
};

const markPaymentFailure = async (req, res) => {
  try {
    const { rideId, reason } = req.body;

    if (!rideId) {
      return res.status(400).json({ message: "rideId is required" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    ride.paymentStatus = "failed";
    ride.paymentFailureReason = reason || "Payment failed";
    await ride.save();

    return res.status(200).json({
      success: true,
      message: "Payment failure recorded",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Could not record payment failure",
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  renderCheckoutPage,
  verifyPayment,
  markPaymentFailure,
};
