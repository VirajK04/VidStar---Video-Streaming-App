import { Router } from "express";
import {
  createTweet,
  deleteTweet,
  getTweetsByUsername,
  getUserTweets,
  updateTweet,
} from "../controllers/tweet.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(createTweet);
router.route("/user").get(getUserTweets);
router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);
router.route("/u/:username").get(getTweetsByUsername);

export default router;
