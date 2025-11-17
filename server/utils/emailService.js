const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, text, html) => {
  try {
    const msg = {
      to,
      from: "rorisangthakholi8@gmail.com", // Verified sender email
      subject,
      text,
      html,
    };

    const info = await sgMail.send(msg);
    console.log("📨 Email sent via SendGrid:", info[0].statusCode);
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err.message);
    throw new Error("Email sending failed");
  }
};

module.exports = { sendEmail };
