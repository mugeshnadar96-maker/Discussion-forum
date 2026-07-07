const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const saltRounds = 10;

const app = express();
const port = 5502;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: "http://localhost:5502",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Database connection
const con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  port: 3307,
  database: "discussionforum",
});

con.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.stack);
    return;
  }
  console.log("Connected to database.");
});

// OTP store
const otpStore = {};

// Serve the signup.html file
app.get("/signup.html", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
  console.log("signup.html file served");
});

// Serve the verify-otp.html file
app.get("/verify-otp.html", (req, res) => {
  res.sendFile(path.join(__dirname, "verify-otp.html"));
});

// Handle form submission for signup
app.post("/signup.html", (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).send("All fields are required.");
  }

  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error("Hashing error:", err);
      return res.status(500).send("Hashing error");
    }

    const sql = "INSERT INTO auth (name, username, password) VALUES (?, ?, ?)";
    con.query(sql, [name, username, hash], (err, result) => {
      if (err) {
        console.error("Insert failed:", err);
        return res.status(500).send("Database insert failed");
      }
      console.log("1 record inserted:", result.insertId);
      res.redirect("/login.html");
    });
  });
});

// Handle login
app.post("/login.html", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("All fields are required.");
  }

  const sql = "SELECT * FROM auth WHERE username = ?";
  con.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Database error");
    }

    if (results.length === 0) {
      return res.status(401).send("User not found");
    }

    const user = results[0];

    // Compare password
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("Password comparison error:", err);
        return res.status(500).send("Error checking password");
      }

      if (!isMatch) {
        return res.status(401).send("Invalid password");
      }

      // Generate OTP and send email
      const otp = generateOTP();
      otpStore[username] = otp;

      console.log(`OTP for ${username} is ${otp} and ${otpStore[username]}`);

      const mailOptions = {
        from: process.env.EMAIL_USER || "cexynos1234@gmail.com",
        to: user.username,
        subject: "Login OTP",
        text: `Your login OTP is: ${otp}`,
        html: `<p>Your login OTP is: <strong>${otp}</strong></p>`,
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error("Failed to send OTP:", err);
          return res
            .status(500)
            .json({ success: false, message: "Failed to send OTP." });
        }
        res.redirect("/verify-otp.html");
      });
    });
  });
});

// Verify OTP
// Verify OTP
app.post("/verify-otp.html", (req, res) => {
  console.log("entered verify-otp.html route");
  const { username, otp } = req.body;
  // console.log("Received OTP:", otpsend);
  // if (!username || !otpsend) {
  //   return res
  //     .status(400)
  //     .json({ success: false, message: "Username and OTP are required." });
  // }

  // Check if the OTP matches the one stored in otpStore
  if (otpStore[username] === otp) {
    delete otpStore[username]; // Remove OTP after successful verification
    console.log(`OTP verified for ${username}`);

    res.redirect("/inside2.html");
  } else {
    console.log(
      `Invalid OTP for ${username}. Expected: ${otpStore[username]}, Received: ${otp}`
    );
    return res.status(401).json({ success: false, message: "Invalid OTP." });
  }
});
// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "cexynos1234@gmail.com",
    pass: process.env.EMAIL_PASS || "qrnt znyv akhw txmc",
  },
  secure: true,
  tls: {
    rejectUnauthorized: false,
  },
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
