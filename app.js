const express = require("express");
const NodeCache = require("node-cache");
const extractor = require("./extractor");

const app = express();
const cache = new NodeCache({ stdTTL: 10, checkperiod: 5 });

app.get("/", async (req, res, next) => {
  username = req.query.username;
  if (username == "" || username == undefined) {
    res.status(400).send("username required");
    return;
  }

  password = req.query.password;
  if (password == "" || password == undefined) {
    res.status(400).send("password required");
    return;
  }

  transactions = cache.get(username);
  if (transactions == undefined) {
    console.log("cache miss: fetching data from CEI...");
    try {
      transactions = await extractor.extractTransactions(username, password);
      cache.set(username, transactions);
    } catch (e) {
      next(e);
    }
  }

  const csv = transactions
    .map(transaction => {
      return transaction.join(",");
    })
    .join("\n");

  res.send(csv);
});

app.listen(process.env.PORT || 3000);
