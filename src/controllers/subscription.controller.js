import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    // TODO: toggle subscription

    const userId = req.user._id

    const isSubscribed = await Subscription.findOneAndDelete({
        subscriber: userId,
        channel: channelId
    })

    if (!isSubscribed) {
        const subscribe = await Subscription.create({
            subscriber: userId,
            channel: channelId
        })

        if (!subscribe) {
            throw new ApiError(500, "Something went wrong while subscribing to channel")
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, subscribe, "Subscribed successfully")
            )
    }

    const unsubscribe = await Subscription.findByIdAndDelete(isSubscribed._id)

    if (!unsubscribe) {
        throw new ApiError(500, "Something went wrong while unsubscribing from channel")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, unsubscribe, "Unsubscribed successfully")
        )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    const channel = await User.findById(channelId)

    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    const channelSubscribers = await Subscription.aggregate([
        {
            $match: {
                channel: mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $group: {
                _id: "$channel",
                subscriberCount: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 1,
                subscriberCount: 1
            }
        }
    ])

    const subscriberCount = channelSubscribers.length > 0 ? channelSubscribers[0].subscriberCount : 0;

    return res
        .status(200)
        .json(
            new ApiResponse(200, { subscriberCount }, "Channel subscribers fetched successfully")
        )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    const subscriber = await User.findById(subscriberId)

    if (!subscriber) {
        throw new ApiError(404, "Subscriber not found")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channelDetails",
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
                channelDetails: {
                    $first: "$channelDetails"
                }
            }
        },
        {
            $project: {
                channelDetails: 1,
            }
        }
    ])

    const totalCount = await Subscription.countDocuments({
        subscriber: new mongoose.Types.ObjectId(subscriberId)
    });

    if (!subscribedChannels.length) {
        return res.status(200).json(
            new ApiResponse(200, { totalCount: 0, channels: [] }, "No subscriptions found")
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { totalCount, channels: subscribedChannels },
            "Subscribed channels fetched successfully"
        )
    );
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}