const sgMail = require("@sendgrid/mail");

// Clean the API key to remove any invalid characters
const apiKey = process.env.SENDGRID_API_KEY?.trim();
if (!apiKey) {
  throw new Error("SENDGRID_API_KEY environment variable is not set");
}

console.log("🔑 SendGrid API Key length:", apiKey.length);
console.log("🔑 SendGrid API Key starts with:", apiKey.substring(0, 10) + "...");

sgMail.setApiKey(apiKey);

const sendEmail = async (to, subject, text, html) => {
  try {
    // Validate required parameters
    if (!to || !subject || !text) {
      throw new Error("Missing required email parameters: to, subject, text");
    }

    const msg = {
      to: to.trim(),
      from: "rorisangthakholi8@gmail.com", // Verified sender email
      subject: subject.trim(),
      text: text.trim(),
      html: html ? html.trim() : undefined,
    };

    console.log("📨 Sending email to:", to);
    console.log("📨 Email subject:", subject);
    console.log("📨 Email from:", msg.from);

    const info = await sgMail.send(msg);
    console.log("📨 Email sent via SendGrid:", info[0].statusCode);
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err.message);
    console.error("❌ Full error details:", JSON.stringify(err, null, 2));

    // Check if it's an API key issue
    if (err.message.includes('Forbidden') || err.code === 403) {
      console.error("❌ This is likely an API key issue. Please check:");
      console.error("   1. SENDGRID_API_KEY is set correctly in Render environment variables");
      console.error("   2. The API key is valid and not expired");
      console.error("   3. The API key has the correct permissions (Mail Send)");
    }

    throw new Error(`Email sending failed: ${err.message}`);
  }
};

module.exports = { sendEmail };
