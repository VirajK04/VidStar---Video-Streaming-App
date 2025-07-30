import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweets.model.js"
import { User } from "../models/user.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet

    const userId = req.user._id

    const { content } = req.body

    if (!content) {
        throw new ApiError(400, "Content is required")
    }

    const tweet = Tweet.create({
        content: content,
        owner: userId
    })

    if (!tweet) {
        throw new ApiError(500, "Something went wrong while creating tweet")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, tweet, "Tweet created successfully")
        )
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets

    const userId = req.user._id

    const userTweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likeUserIds: {
                    $ifNull: [
                        {
                            $map: {
                                input: "$likes",
                                as: "like",
                                in: "$$like.likedBy"
                            }
                        },
                        []
                    ]
                }
            }
        },
        {
            $addFields: {
                isLiked: {
                    $in: [
                        new mongoose.Types.ObjectId(req.user._id),
                        "$likeUserIds"
                    ]
                },
                likeCount: { $size: "$likes" }
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                content: 1,
                owner: 1,
                createdAt: 1,
                isLiked: 1,
                likeCount: 1
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, userTweets, "Tweets from user fetched successfully")
        )
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet

    //1.get tweet id from params
    //2. find the tweet
    //3. get content from body
    //4. update tweet

    const { tweetId } = req.params

    const { content } = req.body

    const userId = req.user._id

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    if (!tweet.owner.equals(userId)) {
        throw new ApiError(400, "You cannot edit this tweet")
    }

    if (!content) {
        return new ApiError(400, "No content provided")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(tweetId,
        {
            $set: {
                content: content
            }
        },
        { new: true }
    )

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedTweet, "Tweet updated successfully")
        )
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet

    //1. get tweet id
    //2. get user id
    //3. validate both
    //4. check if the user wanting to delete tweet is tweet owner
    //5. delete tweet
    //6. Also delete related likes

    const { tweetId } = req.params

    const userId = req.user._id

    if (!tweetId || !userId) {
        throw new ApiError(400, "Tweet id and User id are both required")
    }

    const tweet = await Tweet.findById(tweetId)

    if (tweet.owner.toString() !== userId.toString()) {
        throw new ApiError(400, "You cannot delete this tweet")
    }

    const result = await Tweet.findByIdAndDelete(tweetId)

    try {
        await Like.deleteMany({ tweet: tweetId })
    } catch (error) {
        throw new ApiError(500, "Failed to delete related likes")
    }

    if (!result) {
        throw new ApiError(500, "Something went wrong while deleting tweet")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, result, "Tweet deleted successfully")
        )
})

const getTweetsByUsername = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username) {
        throw new ApiError(400, "Username is required")
    }

    const targetUser = await User.findOne({ username }).select("_idr");

    if (!targetUser) {
        throw new ApiError(404, "User not found");
    }

    const userTweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(targetUser._id)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likeUserIds: {
                    $ifNull: [
                        {
                            $map: {
                                input: "$likes",
                                as: "like",
                                in: "$$like.likedBy"
                            }
                        },
                        []
                    ]
                }
            }
        },
        {
            $addFields: {
                isLiked: {
                    $in: [
                        new mongoose.Types.ObjectId(req.user._id),
                        "$likeUserIds"
                    ]
                },
                likeCount: { $size: "$likes" }
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                updatedAt: 1,
                isLiked: 1,
                likeCount: 1
            }
        }
    ])

    if (!userTweets) {
        throw new ApiError(500, "Could not get user tweets")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, userTweets, "User tweets fetched successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getTweetsByUsername
}
