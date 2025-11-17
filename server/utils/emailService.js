const sgMail = require("@sendgrid/mail");

// Clean the API key to remove any invalid characters
const apiKey = process.env.SENDGRID_API_KEY?.trim();
if (!apiKey) {
  throw new Error("SENDGRID_API_KEY environment variable is not set");
}

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
    const info = await sgMail.send(msg);
    console.log("📨 Email sent via SendGrid:", info[0].statusCode);
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err.message);
    console.error("❌ Full error:", err);
    throw new Error(`Email sending failed: ${err.message}`);
  }
};

module.exports = { sendEmail };
