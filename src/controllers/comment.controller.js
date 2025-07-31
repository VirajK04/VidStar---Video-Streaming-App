import mongoose from "mongoose"
import { Comment } from "../models/comment.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { pipeline } from "stream"
import { Like } from "../models/like.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    const userId = req.user._id

    const videoExists = await Video.findById(videoId);
    if (!videoExists) {
        throw new ApiError(404, "Video not found");
    }

    const pipeline = [
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
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
                            avatar: 1,
                            fullname: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
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
                        new mongoose.Types.ObjectId(userId),
                        "$likeUserIds"
                    ]
                },
                likeCount: { $size: "$likes" }
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
                updatedAt: 1,
                likeCount: 1,
                isLiked: 1
            }
        }
    ]

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: true
    }

    const result = await Comment.aggregatePaginate(pipeline, options)

    // console.log(result)

    if (!result) {
        throw new ApiError(500, "Something went wrong while getting comments")
    }

    res.
        status(200)
        .json(
            new ApiResponse(
                200,
                {
                    totalDocs: result.totalDocs,
                    count: result.docs?.length,
                    totalComments: result.docs,
                    totalPages: result.totalPages,
                    currentPage: result.page,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage,
                    nextPage: result.nextPage,
                    prevPage: result.prevPage,
                    pagingCounter: result.pagingCounter,
                },
                "Comments fetched successfully")
        )


})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const userId = req.user._id
    const { videoId } = req.params

    const { content } = req.body
    if (!content) {
        throw new ApiError(400, "Content is required")
    }

    const videoExists = await Video.findById(videoId);
    if (!videoExists) {
        throw new ApiError(404, "Video not found");
    }

    const comment = await Comment.create({
        content: content,
        video: videoId,
        owner: userId
    })

    if (!comment) {
        throw new ApiError(500, "Something went wrong with creating the comment")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, comment, "Comment created successfully")
        )
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment

    const { commentId } = req.params

    const { content } = req.body

    if (!content) {
        throw new ApiError(400, "Content is required")
    }

    const updatedComment = await Comment.findByIdAndUpdate(commentId,
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
            new ApiResponse(200, updatedComment, "Comment updated successfully")
        )
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment

    const { commentId } = req.params

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(400, "Comment not found")
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this comment")
    }

    const deletedComment = await Comment.findByIdAndDelete(commentId)

    try {
            await Like.deleteMany({ comment: commentId })
        } catch (error) {
            throw new ApiError(500, "Failed to delete related likes")
        }

    if (!deletedComment) {
        throw new ApiError(500, "Something went wrong while deleting the comment")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, deletedComment, "Comment deleted successfully")
        )
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}
