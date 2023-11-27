require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://homehive-84c83.web.app"],
    credentials: true,
  })
);

// HomeHive
// Il1LGGqlm76OFtfM

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("HOMEHIVE Server Running");
});
app.listen(port, () => {
  console.log(`http://localhost:${port}/`);
});

const uri = `${process.env.MDB_URI}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    sameSite: "none",
  },
});

async function run() {
  try {
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(req.body);

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SEC, {
        expiresIn: "1h",
      });

      return res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("Logged Out___________", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    const database = client.db("homeHiveDB");
    const usersCollection = database.collection("usersCollection");
    const propertiesCollection = database.collection("propertiesCollection");

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const exists = await usersCollection.findOne(query);
      if (exists) {
        return res.send(exists);
      }
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      );
      return res.send(result);
    });

    app.get("/allProperties", async (req, res) => {
      let query = {};
      if (req.query?.verificationStatus) {
        query = { verificationStatus: req.query.verificationStatus };
      }

      const cursor = propertiesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
  } catch (err) {
    console.log(err);
  }
}
run().catch(console.dir);
