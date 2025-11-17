require("dotenv").config();
const { sendEmail } = require("./utils/emailService");

async function testSendGrid() {
  try {
    console.log("🧪 Testing SendGrid email service...");

    await sendEmail(
      "motlatsimohami8@gmail.com", // Test recipient
      "SendGrid Test - Career Platform",
      "This is a test email from SendGrid integration.",
      "<h1>SendGrid Test</h1><p>This is a test email from the Career Guidance Platform.</p><p>If you received this, SendGrid is working correctly!</p>"
    );

    console.log("✅ SendGrid test email sent successfully!");
  } catch (err) {
    console.error("❌ SendGrid test failed:", err.message);
  }
}

testSendGrid();
