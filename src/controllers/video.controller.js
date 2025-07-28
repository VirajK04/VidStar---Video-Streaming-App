import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

    const sortDirection = sortType.toLowerCase() === "asc" ? 1 : -1

    const pipeline = [
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
                isPublished: true
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
                foreignField: "video",
                as: "likes",
            }
        },
        {
            $addFields: {
                likeCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $sort: {
                [sortBy]: sortDirection
            }
        },
        {
            $project: {
                likeCount: 1,
                owner: 1,
                views: 1,
                videoFile: 1,
                createdAt: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                isPublished: 1
            }
        }
    ]

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: true
    }

    const videos = await Video.aggregatePaginate(pipeline, options)

    if (!videos) {
        throw new ApiError(500, "Something went wrong with getting all videos")
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                totalDocs: videos.totalDocs,
                count: videos.docs?.length,
                videos: videos.docs,
                totalPages: videos.totalPages,
                currentPage: videos.page,
                hasNextPage: videos.hasNextPage,
                hasPrevPage: videos.hasPrevPage,
                nextPage: videos.nextPage,
                prevPage: videos.prevPage,
                pagingCounter: videos.pagingCounter
            },
            "Videos fetched successfully"
        )
    );

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video

    const userId = req.user._id

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required")
    }

    const videoLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if (!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Video and thumbnail are required")
    }

    let video = await uploadOnCloudinary(videoLocalPath)
    let thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!video || !thumbnail) {
        throw new ApiError(500, "Something went wrong with uploading the video and thumbnail")
    }

    const createdVideo = await Video.create({
        title: title,
        description: description,
        videoFile: video.url,
        thumbnail: thumbnail.url,
        owner: userId,
        duration: video.duration
    })

    if (!createdVideo) {
        throw new ApiError(500, "Something went wrong with creating the video")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, createdVideo, "Video created successfully")
        )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc: { views: 1 } },
        { new: true }
    )

    const pipeline = [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
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
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments",
                pipeline: [

                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "createdBy",
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
                            createdBy: {
                                $first: "$createdBy"
                            }
                        }
                    },
                    {
                        $project: {
                            content: 1,
                            createdBy: 1,
                            createdAt: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
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
                    $map: {
                        input: "$likes",
                        as: "like",
                        in: "$$like.likedBy"
                    }
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
                owner: 1,
                comments: 1,
                createdAt: 1,
                isLiked: 1,
                likeCount: 1,
                views: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
            }
        }
    ]

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (!video.isPublished) {
        throw new ApiError(403, "Video is not published yet")
    }

    const videoResult = await Video.aggregate(pipeline)
    if (!videoResult) {
        throw new ApiError(500, "Something went wrong with getting the video")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, videoResult, "Video found successfully")
        )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    const { title, description } = req.body

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required")
    }

    const userId = req.user._id

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (!video.owner.equals(userId)) {
        throw new ApiError(403, "You are not allowed to update this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title,
                description: description
            }
        },
        { new: true }
    ).select("-owner -likes -comments -duration -views -isPublished -created_at -updated_at")

    if (!updatedVideo) {
        throw new ApiError(500, "Something went wrong with updating the video")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Video updated successfully")
        )

})

const updateThumbnail = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    const thumbnailLocalPath = req.files?.thumbnail?.path

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required")
    }

    const thumbnail = await uploadOnCloudinary(path)

    if (!thumbnail.url) {
        throw new ApiError(500, "Something went wrong with updating the thumbnail")
    }

    const userId = req.user._id

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (!video.owner.equals(userId)) {
        throw new ApiError(403, "You are not allowed to update this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                thumbnail: thumbnail.url
            }
        },
        { new: true }
    ).select("-owner -likes -comments -duration -views -isPublished -created_at -updated_at")

    if (!updatedVideo) {
        throw new ApiError(500, "Something went wrong with updating the video")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Video updated successfully")
        )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    const userId = req.user._id

    if (!videoId || !userId) {
        throw new ApiError(400, "Video id and User id are both required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (!video.owner.equals(userId)) {
        throw new ApiError(403, "You are not allowed to delete this video");
    }

    const result = await Video.findByIdAndDelete(videoId)

    if (!result) {
        throw new ApiError(500, "Something went wrong while deleting video")
    }

    try {
        await Like.deleteMany({ video: videoId })
        await Comment.deleteMany({ video: videoId })
    } catch (error) {
        throw new ApiError(500, "Failed to delete related likes and comments")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const userId = req.user._id

    if (!videoId || !userId) {
        throw new ApiError(400, "Video id and User id are both required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (!video.owner.equals(userId)) {
        throw new ApiError(403, "You are not allowed to update this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        { new: true }
    ).select("-owner -likes -comments -duration -views -created_at -updated_at")

    if (!updatedVideo) {
        throw new ApiError(500, "Something went wrong with updating the video")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Video updated successfully")
        )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    updateThumbnail
}
