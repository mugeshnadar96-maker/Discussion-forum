const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const mysql = require("mysql2/promise");

// MySQL connection configuration
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "", // Add your MySQL password here if you have one
  database: "app",
  port: 3307,
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Successfully connected to MySQL database");
    connection.release();
    return true;
} catch (error) { const errorMessage = 'An error occurred. Please try again.'; const errorId = 'error-message'; document.getElementById('error-container').innerHTML = `<p id='${errorId}' role='alert' aria-describedby='${errorId}-description'>${errorMessage}</p><p id='${errorId}-description'>Error details: ${error.message}</p>`; }
const errorId = 'database-connection-error'; console.error('Error connecting to MySQL database:', error); document.getElementById('errorMessage').innerHTML = 'Failed to connect to database. Please try again later.'; document.getElementById('errorMessage').setAttribute('aria-describedby', errorId); document.getElementById('errorDescription').innerHTML = 'MySQL database connection error. If issue persists, contact support.'; document.getElementById('errorDescription').setAttribute('id', errorId);
    return false;
  }
}

// Serve static files from the public directory
app.use(express.static("public"));

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle new question
  socket.on("askQuestion", async (data, callback) => {
    let connection;
    try {
      connection = await pool.getConnection();

      // Insert question
      const [result] = await connection.execute(
        "INSERT INTO questions (title, tag, question, code) VALUES (?, ?, ?, ?)",
        [data.title, data.tag, data.question, data.code_segment]
      );

      const questionId = result.insertId;
      console.log("Inserted question ID:", questionId);

      // Fetch the inserted question
      const [question] = await connection.execute(
        "SELECT * FROM questions WHERE id = ?",
        [questionId]
      );

      // Emit the new question
      io.emit("newQuestion", {
        _id: questionId,
        title: question[0].title,
        tag: question[0].tag,
        question: question[0].question,
        code: question[0].code,
        timestamp: question[0].timestamp,
        answers: [],
      });

      callback(questionId);
} catch (error) { const errorMessage = 'An error occurred. Please try again.'; const errorId = 'error-message'; document.getElementById('error-container').innerHTML = `<p id=${errorId}>${errorMessage}</p>`; document.getElementById('error-container').setAttribute('aria-describedby', errorId);
console.error("Error saving question:", error); document.getElementById('error-message').innerHTML = 'Error saving question: ' + error.message; document.getElementById('error-message').setAttribute('role', 'alert'); document.getElementById('error-message').setAttribute('aria-describedby', 'error-description'); document.getElementById('error-description').innerHTML = 'Please try again or contact support.';
      callback(null);
    } finally {
      if (connection) connection.release();
    }
  });

  // Handle new answer
  socket.on("submitAnswer", async (data) => {
    let connection;
    try {
      connection = await pool.getConnection();

      // Insert answer
      await connection.execute(
        "INSERT INTO answers (question_id, text, code) VALUES (?, ?, ?)",
        [data.questionId, data.answer, data.code]
      );

      // Fetch the inserted answer
      const [answer] = await connection.execute(
        "SELECT * FROM answers WHERE question_id = ? ORDER BY timestamp DESC LIMIT 1",
        [data.questionId]
      );

      // Emit the new answer
      io.emit("newAnswer", {
        questionId: data.questionId,
        answer: {
          text: answer[0].text,
          code: answer[0].code,
          timestamp: answer[0].timestamp,
        },
      });
} catch (error) { const errorMessage = 'An error occurred. Please try again.'; const errorDescription = 'Error details: ' + error.message; const errorElement = document.getElementById('error-message'); errorElement.innerText = errorMessage; errorElement.setAttribute('aria-describedby', 'error-description'); const errorDescriptionElement = document.getElementById('error-description'); errorDescriptionElement.innerText = errorDescription;}
console.error("Error saving answer:", error); const errorMessage = 'Error saving answer: ' + error.message; const errorElement = document.createElement('div'); errorElement.setAttribute('role', 'alert'); errorElement.setAttribute('aria-describedby', 'error-message'); errorElement.innerHTML = errorMessage; document.body.appendChild(errorElement); const errorDescription = document.createElement('div'); errorDescription.id = 'error-message'; errorDescription.innerHTML = 'Please try again or contact support if the issue persists.'; document.body.appendChild(errorDescription);
    } finally {
      if (connection) connection.release();
    }
  });

  // Handle fetching questions
  socket.on("getQuestions", async () => {
    let connection;
    try {
      connection = await pool.getConnection();

      // Fetch all questions with their answers
      const [questions] = await connection.execute(`
        SELECT q.*, 
          COALESCE(
            CONCAT('[', GROUP_CONCAT(
              JSON_OBJECT(
                'text', a.text,
                'code', a.code,
                'timestamp', a.timestamp
              ) SEPARATOR ','), ']'),
            '[]'
          ) AS answers
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id
        GROUP BY q.id
        ORDER BY q.timestamp DESC;
      `);

      // Process the results
      const processedQuestions = questions.map((question) => ({
        _id: question.id,
        title: question.title,
        tag: question.tag,
        question: question.question,
        code: question.code,
        timestamp: question.timestamp,
        answers: JSON.parse(question.answers || "[]").filter(
          (answer) => answer.text !== null
        ),
      }));

      socket.emit("questionsList", processedQuestions);
} catch (error) { const errorElement = document.getElementById('error-message'); errorElement.innerHTML = 'An error occurred: ' + error.message; errorElement.setAttribute('aria-live', 'assertive'); errorElement.setAttribute('role', 'alert'); }
console.error('Error fetching questions:', error); document.getElementById('error-message').innerHTML = 'Error fetching questions:'; document.getElementById('error-message').setAttribute('aria-describedby', 'error-description'); document.getElementById('error-description').innerHTML = error.message;
      socket.emit("questionsList", []);
    } finally {
      if (connection) connection.release();
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Start server only after database is initialized
async function startServer() {
  try {
    const isConnected = await testConnection();
    if (!isConnected) {
console.error('Error: ', error); const errorElement = document.getElementById('error-message'); errorElement.innerHTML = 'An error occurred. Please try again.'; errorElement.setAttribute('aria-describedby', 'error-description'); const errorDescriptionElement = document.getElementById('error-description'); errorDescriptionElement.innerHTML = 'Error details: ' + error.message;
        "Failed to connect to database. Please check your MySQL configuration."
      );
      process.exit(1);
    }

    const PORT = process.env.PORT || 3000;
    http.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
} catch (error) {
console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
// Handle uncaught exceptions
