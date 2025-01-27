const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cookieParser = require("cookie-parser");
const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://life-line-fa28d.web.app",
    "https://life-line-fa28d.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.crgl3kb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("lifeLineDB").collection("users");
    const donationsCollection = client.db("lifeLineDB").collection("donations");
    const blogsCollection = client.db("lifeLineDB").collection("blogs");
    const paymentsCollection = client.db("lifeLineDB").collection("payments");

    /* Verify Token Middleware */
    const verifyToken = (req, res, next) => {
      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send("Unauthorized access");
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(403).send({message: "forbidden access"});
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const result = await usersCollection.findOne(query);
      const isAdmin = result?.user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({message: "forbidden access"});
      }
      next();
    };

    const verifyVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const result = await usersCollection.findOne(query);
      const isAdmin = result?.user?.role === "volunteer";
      if (!isAdmin) {
        return res.status(403).send({message: "forbidden access"});
      }
      next();
    };

    const verifyDonor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const result = await usersCollection.findOne(query);
      const isAdmin = result?.user?.role === "donor";
      if (!isAdmin) {
        return res.status(403).send({message: "forbidden access"});
      }
      next();
    };

    /* jwt api */
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({token});
    });

    // app.post("/jwt", async (req, res) => {
    //   const user = req.body;
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    //     expiresIn: "365d",
    //   });
    //   res
    //     .cookie("token", token, {
    //       httpOnly: true,
    //       secure: process.env.NODE_ENV === "production",
    //       sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    //     })
    //     .send({success: true});
    // });

    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({success: true});
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    /* users api */
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = {email: user?.email};
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send({message: "user already exists", insertedId: null});
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({email});
      res.send(result);
    });

    app.put("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = {email};
      const updateDoc = {
        $set: {user},
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.put("/users/status/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = {email};
      const updateDoc = {
        $set: {user},
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/user/status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          "user.status": "blocked",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    /* user-state api */
    app.get("/admin-stat", verifyToken, verifyAdmin, async (req, res) => {
      const totalDonation = await donationsCollection.countDocuments();
      const totalUsers = await usersCollection.countDocuments();
      const totalPayments = await paymentsCollection.countDocuments();
      res.send({totalDonation, totalUsers, totalPayments});
    });

    app.get(
      "/volunteer-stat",
      verifyToken,
      verifyVolunteer,
      async (req, res) => {
        const totalDonation = await donationsCollection.countDocuments();
        const totalUsers = await usersCollection.countDocuments();
        const totalPayments = await paymentsCollection.countDocuments();
        res.send({totalDonation, totalUsers, totalPayments});
      }
    );

    /* donation api */
    app.post("/donations", async (req, res) => {
      const donation = req.body;
      const result = await donationsCollection.insertOne(donation);
      res.send(result);
    });

    app.get("/donations", async (req, res) => {
      const result = await donationsCollection.find().toArray();
      res.send(result);
    });

    app.get("/donations/:email", async (req, res) => {
      const email = req.params.email;
      const result = await donationsCollection.find({email}).toArray();
      res.send(result);
    });

    app.get("/donation/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await donationsCollection.findOne(query);
      res.send(result);
    });

    app.put("/donation/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const donation = req.body;
      const updateDoc = {
        $set: {...donation},
      };
      const result = await donationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/our-donation/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const donation = req.body;
      const updateDoc = {
        $set: {...donation},
      };
      const result = await donationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/donation/status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          status: "inprogress",
        },
      };
      const result = await donationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/donation/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await donationsCollection.deleteOne(query);
      res.send(result);
    });

    /* blog api */
    app.post("/blogs", async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    app.patch("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          status: "published",
        },
      };
      const result = await blogsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const blog = req.body;
      const updateDoc = {
        $set: {...blog},
      };
      const result = await blogsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

    /* pagination and filtering api */
    app.get("/all-donations", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      let query = {};
      if (filter) query = {status: filter};
      const result = await donationsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/donations-count", async (req, res) => {
      const count = await donationsCollection.countDocuments();
      res.send({count});
    });

    app.get("/all-blogs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      let query = {};
      if (filter) query = {status: filter};
      const result = await blogsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/blogs-count", async (req, res) => {
      const count = await blogsCollection.countDocuments();
      res.send({count});
    });

    app.get("/all-users", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      let query = {};
      if (filter) query = {status: filter};
      const result = await usersCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/users-count", async (req, res) => {
      const count = await usersCollection.countDocuments();
      res.send({count});
    });

    /* search api */

    /* payment api and pagination */
    app.post("/create-payment-intent", async (req, res) => {
      const {price} = req.body;
      console.log({price});
      const priceInCent = parseFloat(price * 100);
      if (!price || priceInCent < 1) return;
      const {client_secret} = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({clientSecret: client_secret});
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      res.send(result);
    });

    app.get("/payments", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const result = await paymentsCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/payment-count", async (req, res) => {
      const count = await paymentsCollection.countDocuments();
      res.send({count});
    });

    // Send a ping to confirm a successful connection
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Life Line server is running");
});

app.listen(port, () => {
  console.log(`Life Line server is running on port: ${port}`);
});
