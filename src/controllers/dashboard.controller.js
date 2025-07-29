import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

    const userId = req.user._id

    const subscriberCount = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // $count: "subscriberCount" Alternative and it will just provide total subscribers like - subscriberCount[0].subscriberCount It does not need project stage
            $group: {
                _id: null,
                totalSubscribers: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                totalSubscribers: 1
            }
        }
    ])

    const videoCount = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalViews: { $sum: "$views" }
            }
        },
        {
            $project: {
                _id: 0,
                totalVideos: 1,
                totalViews: 1
            }
        }
    ])


    //Likes count is a very resource intensive part as it is adding video data to each like document
    //I would like to think of an optimzation in future or if it is unnecessary then remove it altogether
    const likesCount = await Like.aggregate([
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideos"
            }
        },
        {
            $match: {
                "likedVideos.owner": userId
            }
        },
        {
            $group: {
                _id: null,
                totalLikes: {
                    $sum: 1,
                },
            },
        },
        {
            $project: {
                _id: 0,
                totalLikes: 1,
            },
        },
    ])

    const data = {
        totalSubscribers: subscriberCount[0]?.totalSubscribers ? subscriberCount[0].totalSubscribers : 0,
        totalVideos: videoCount[0]?.totalVideos ? videoCount[0].totalVideos : 0,
        totalViews: videoCount[0]?.totalViews ? videoCount[0].totalViews : 0,
        totalLikes: likesCount[0]?.totalLikes ? likesCount[0].totalLikes : 0
    }

    if (!data) {
        throw new ApiError(404, "Stats not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, data, "Stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel

    const userId = req.user._id

    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    if (!videos) {
        throw new ApiError(404, "Videos not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

export {
    getChannelStats,
    getChannelVideos
}