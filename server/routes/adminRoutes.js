router.post("/approve-registration", async (req, res) => {
  try {
    const { id, email, name, role } = req.body;

    if (!id || !email || !role) {
      return res.status(400).json({ success: false, message: "Missing fields." });
    }

    const tempPassword = generatePassword();

    let firebaseUser;

    // 1️⃣ FIRST: check if email already exists in Firebase Auth
    try {
      firebaseUser = await auth.getUserByEmail(email);
      console.log("User already exists:", firebaseUser.uid);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // 2️⃣ If user does NOT exist → create new one
        firebaseUser = await auth.createUser({
          email,
          password: tempPassword,
          displayName: name,
          emailVerified: true,
        });
        console.log("User created:", firebaseUser.uid);
      } else {
        throw err;
      }
    }

    // 3️⃣ Update original Firestore collection
    const collectionName = role === "institution" ? "institutions" : "companies";

    await db.collection(collectionName).doc(id).update({
      status: "approved",
      approvedAt: new Date().toISOString(),
      firebaseUid: firebaseUser.uid,
      password: tempPassword,
    });

    // 4️⃣ Create user doc in "users" collection (safe)
    await db.collection("users").doc(firebaseUser.uid).set(
      {
        uid: firebaseUser.uid,
        name,
        email,
        role,
        approved: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 5️⃣ Send email
    await transporter.sendMail({
      from: `"Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Registration Is Approved",
      text: `Hi ${name},\n\nYour registration has been approved.\n\nTemporary Password: ${tempPassword}\n\nPlease log in and change it immediately.\n\nRegards,\nAdmin`,
    });

    return res.json({ success: true, message: "Approved and email sent." });
  } catch (error) {
    console.error("Approval error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
});
