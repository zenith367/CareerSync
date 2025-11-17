// studentRoutes.js
const express = require("express");
const router = express.Router();
const { db } = require("../services/firebase"); // Firestore instance
const { sendEmail } = require("../utils/emailService");

// ==========================
// 1️⃣ REGISTER OR UPDATE STUDENT PROFILE
// ==========================
router.post("/register", async (req, res) => {
  try {
    const { studentId, name, email, phone, qualifications, marks } = req.body;

    if (!studentId || !name || !email) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const studentRef = db.collection("students").doc(studentId);
    await studentRef.set(
      { name, email, phone, qualifications, marks },
      { merge: true }
    );

    res.status(200).json({ message: "Student registered/updated successfully." });
  } catch (error) {
    console.error("Error registering student:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================
// 2️⃣ APPLY FOR A COURSE
// ==========================
router.post("/applyCourse", async (req, res) => {
  try {
    const { studentId, institutionId, courseId, courseName } = req.body;

    if (!studentId || !institutionId || !courseId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Check eligibility: get course requirements
    const courseDoc = await db.collection("institutions").doc(institutionId).collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ message: "Course not found." });
    }
    const courseData = courseDoc.data();

    // Get student data
    const studentDoc = await db.collection("students").doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ message: "Student not found." });
    }
    const studentData = studentDoc.data();

    // Check eligibility
    const hasRequiredSubjects = courseData.requiredSubjects.every(sub => studentData.qualifications?.includes(sub));
    const hasMinMarks = studentData.marks >= courseData.minMarks;
    const hasCertificates = courseData.requiredCertificates.every(cert => studentData.certificates?.includes(cert));

    if (!hasRequiredSubjects || !hasMinMarks || !hasCertificates) {
      return res.status(400).json({ message: "You do not meet the eligibility criteria for this course." });
    }

    // Check max 2 applications per institution
    const existingAppsSnap = await db.collectionGroup("registrations")
      .where("studentId", "==", studentId)
      .where("institutionId", "==", institutionId)
      .where("type", "==", "course")
      .get();

    if (existingAppsSnap.size >= 2) {
      return res.status(400).json({
        message: "You can only apply for up to two courses per institution.",
      });
    }

    const duplicate = existingAppsSnap.docs.find(doc => doc.data().courseId === courseId);
    if (duplicate) {
      return res.status(400).json({ message: "You already applied for this course." });
    }

    const newApp = {
      studentId,
      institutionId,
      courseId,
      courseName,
      type: "course",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await db.collection("students").doc(studentId).collection("registrations").add(newApp);
    res.status(200).json({ message: "Course application submitted successfully." });
  } catch (error) {
    console.error("Error applying for course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================
// 3️⃣ UPLOAD ACADEMIC TRANSCRIPTS & CERTIFICATES (metadata only)
// ==========================
router.post("/uploadDocs", async (req, res) => {
  try {
    const { studentId, fileName, fileURL, fileType } = req.body;

    if (!studentId || !fileURL || !fileType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const studentRef = db.collection("students").doc(studentId);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) {
      return res.status(404).json({ message: "Student not found." });
    }

    if (fileType === "transcript") {
      await studentRef.collection("transcripts").add({
        fileName,
        fileURL,
        uploadedAt: new Date().toISOString(),
      });
    } else {
      await studentRef.collection("documents").add({
        fileName,
        fileURL,
        fileType,
        uploadedAt: new Date().toISOString(),
      });
    }

    res.status(200).json({ message: "Document metadata uploaded successfully." });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================
// 4️⃣ FETCH ADMISSIONS RESULTS
// ==========================
router.get("/admissions/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    const snapshot = await db.collection("students").doc(studentId).collection("registrations")
      .where("type", "==", "course")
      .get();

    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching admissions:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================
// 5️⃣ FETCH JOB POSTS MATCHING STUDENT QUALIFICATIONS
// ==========================
router.get("/jobs/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const studentDoc = await db.collection("students").doc(studentId).get();

    if (!studentDoc.exists) return res.status(404).json({ message: "Student not found." });

    const studentData = studentDoc.data();
    const qualifications = studentData.qualifications || [];
    const marks = studentData.marks || 0;
    const certificates = studentData.certificates || [];

    // Use collectionGroup to get all jobs
    const jobsSnapshot = await db.collectionGroup("jobs").get();

    const matchedJobs = jobsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(job => {
        const hasSkills = job.requirements?.some(req => qualifications.includes(req));
        const hasMarks = marks >= job.minMarks;
        const hasCerts = job.requiredCertificates?.every(cert => certificates.includes(cert));
        return hasSkills && hasMarks && hasCerts;
      });

    res.status(200).json(matchedJobs);
  } catch (error) {
    console.error("Error fetching job posts:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================
// 6️⃣ APPLY FOR JOB OPENINGS
// ==========================
router.post("/applyJob", async (req, res) => {
  try {
    const { studentId, jobId, companyId } = req.body;

    if (!studentId || !jobId || !companyId) return res.status(400).json({ message: "Missing required fields." });

    // Check if already applied
    const existing = await db.collection("students").doc(studentId).collection("registrations")
      .where("jobId", "==", jobId)
      .where("type", "==", "job")
      .get();

    if (!existing.empty) {
      return res.status(400).json({ message: "Already applied for this job." });
    }

    const newApp = {
      studentId,
      jobId,
      companyId,
      type: "job",
      status: "applied",
      appliedAt: new Date().toISOString(),
    };

    await db.collection("students").doc(studentId).collection("registrations").add(newApp);
    res.status(200).json({ message: "Job application submitted successfully." });
  } catch (error) {
    console.error("Error applying for job:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================
// 7️⃣ EMAIL NOTIFICATIONS
// ==========================
async function sendNotificationEmail(to, subject, text, html) {
  try {
    await sendEmail(to, subject, text, html);
    console.log("Email sent successfully to:", to);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

router.post("/notifyAdmission", async (req, res) => {
  try {
    const { email, studentName, institution } = req.body;
    const subject = "🎉 Admission Update";
    const message = `Dear ${studentName},\n\nCongratulations! You have been admitted to ${institution}.\n\nBest regards,\nCareer Guidance Platform`;

    await sendNotificationEmail(email, subject, message);
    res.status(200).json({ message: "Admission notification email sent." });
  } catch (error) {
    console.error("Error sending admission email:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/notifyJobMatch", async (req, res) => {
  try {
    const { email, studentName, jobTitle } = req.body;
    const subject = "💼 Job Match Found";
    const message = `Hi ${studentName},\n\nWe found a job that matches your qualifications: ${jobTitle}.\n\nCheck your dashboard for more details!\n\nBest,\nCareer Guidance Platform`;

    await sendNotificationEmail(email, subject, message);
    res.status(200).json({ message: "Job match notification email sent." });
  } catch (error) {
    console.error("Error sending job match email:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
