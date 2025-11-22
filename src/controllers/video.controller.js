import mongoose, { isValidObjectId, Schema } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteImageFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  const match = {
    isPublished: true,
  };
  const sort = {};
  const options = { page, limit };

  if (query?.trim()) match.title = { $regex: query?.trim(), $options: "i" };
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id format");
    }
    match["owner._id"] = new mongoose.Types.ObjectId(userId);
  }

  if (sortBy) {
    sort[sortBy] = sortType?.toLowerCase() === "asc" ? 1 : -1;
  }

  const pipeline = [
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        "owner.refreshToken": 0,
        "owner.password": 0,
      },
    },
    {
      $match: match,
    },
  ];

  if (Object.keys(sort).length > 0) {
    pipeline.push({ $sort: sort });
  }

  const videoAggregation = Video.aggregate(pipeline);

  const paginatedVideos = await Video.aggregatePaginate(
    videoAggregation,
    options
  );

  if (!paginatedVideos) {
    throw new ApiError(500, "Failed to retrieve videos");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, paginatedVideos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  if ([title, description].some((val) => val === "")) {
    throw new ApiError(400, "All fields are required");
  }

  if (!Object.keys(req.files).length || Object.keys(req?.files).length < 2) {
    throw new ApiError(400, "Video and thumbnail files are required");
  }

  const videoFileLocalPath = req.files?.videoFile[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);

  if (!videoFile) {
    throw new ApiError(400, "Video file is required");
  }

  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  const video = {
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: videoFile.duration,
    owner: req.user?._id,
  };

  const createdVideo = await Video.create(video);

  if (!createdVideo) {
    throw new ApiError(500, "Something went wrong while uploading video");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdVideo, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id

  if (!videoId?.trim()) {
    throw new ApiError(401, "video id is required");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        "owner.refreshToken": 0,
        "owner.password": 0,
      },
    },
  ]);

  if (!video) {
    throw new ApiError(401, "video id is invalid");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video retrieved successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "video id is invalid");
  }

  const { title, description } = req.body;

  if ([title, description].some((val) => val === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail image is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload thumbnail image to cloudinary");
  }

  const isOldThumbnailDeleted = await deleteImageFromCloudinary(
    video.thumbnail
  );

  if (!isOldThumbnailDeleted) {
    throw new ApiError(
      500,
      "Something went wrong while deleting old thumbnail"
    );
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: thumbnail?.url,
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(500, "Something went wrong while updating the video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "video is updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Invalid video id");
  }

  await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Invalid video id");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video.isPublished,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video publish status updated."));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
