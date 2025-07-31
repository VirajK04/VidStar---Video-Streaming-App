import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"
import { Tweet } from "../models/tweets.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: toggle like on video

    //1. Check if video exists
    //2. Check if user has liked it
    //3. If liked then remove it
    //4. if not then add a like document

    const userId = req.user._id

    const video = await Video.findById(videoId);
    if (!video) {
        return next(new ApiError(404, `video with id ${videoId} does not exist`));
    }

    const like = await Like.findOne({
        likedBy: userId,
        video: videoId
    })

    if (!like) {
        const createdLike = await Like.create({
            video: videoId,
            likedBy: userId
        })

        if (!createdLike) {
            throw new ApiError(500, "Something went wrong with creating the like")
        }

        return res
            .status(201)
            .json(
                new ApiResponse(201, createdLike, "Like created successfully")
            )
    }

    const deletedLike = await Like.findByIdAndDelete(like._id)

    if (!deletedLike) {
        throw new ApiError(500, "Something went wrong while deleting the like")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, deletedLike, "Like deleted successfully")
        )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    //TODO: toggle like on comment

    const userId = req.user._id

    const comment = await Comment.findById(commentId);
    if (!comment) {
        return next(new ApiError(404, `comment with id ${commentId} does not exist`));
    }

    const like = await Like.findOne({
        likedBy: userId,
        comment: commentId
    })

    if (!like) {
        const createdLike = await Like.create({
            comment: commentId,
            likedBy: userId
        })

        if (!createdLike) {
            throw new ApiError(500, "Something went wrong with creating the like")
        }

        return res
            .status(201)
            .json(
                new ApiResponse(201, createdLike, "Like created successfully")
            )
    }

    const deletedLike = await Like.findByIdAndDelete(like._id)

    if (!deletedLike) {
        throw new ApiError(500, "Something went wrong while deleting the like")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, deletedLike, "Like deleted successfully")
        )

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    //TODO: toggle like on tweet

    const userId = req.user._id

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        return next(new ApiError(404, `tweet with id ${tweetId} does not exist`));
    }

    const like = await Like.findOne({
        likedBy: userId,
        tweet: tweetId
    })

    if (!like) {
        const createdLike = await Like.create({
            tweet: tweetId,
            likedBy: userId
        })

        if (!createdLike) {
            throw new ApiError(500, "Something went wrong with creating the like")
        }

        return res
            .status(201)
            .json(
                new ApiResponse(201, createdLike, "Like created successfully")
            )
    }

    const deletedLike = await Like.findByIdAndDelete(like._id)

    if (!deletedLike) {
        throw new ApiError(500, "Something went wrong while deleting the like")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, deletedLike, "Like deleted successfully")
        )
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos

    const userId = req.user._id

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: {
                    $exists: true,
                    $ne: null
                }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videos",
                pipeline: [
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
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    },
                    {
                        $project: {
                            videoFile: 1,
                            duration: 1,
                            views: 1,
                            owner: 1,
                            title: 1,
                            thumbnail: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$videos"
            }
        },
        {
            $sort: {
                createdAt: -1 // Desecending order - recently liked videos first
            }
        },

        {
            $project: {
                videos: 1,
                likedBy: 1
            }
        }
    ])

    if (!likedVideos) {
        throw new ApiError(500, "No liked videos")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, likedVideos, "Liked Videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}