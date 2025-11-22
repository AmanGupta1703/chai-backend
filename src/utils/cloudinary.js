import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const getPublicIdFromUrl = (imageUrl) => {
  try {
    if (!imageUrl) throw new Error("imageUrl is required");

    const url = new URL(imageUrl);
    const path = url?.pathname ?? "";
    const filename = path?.split("/")?.pop() ?? "";
    const publicId = filename?.split(".")?.[0] || null;

    return publicId;
  } catch (error) {
    return null;
  }
};

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfull
    //console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

const deleteImageFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) throw new Error("No image URL provided");

    const publicId = getPublicIdFromUrl(imageUrl);

    if (!publicId) {
      throw new Error("No image url provided");
    }

    const response = await cloudinary.uploader.destroy(publicId);
    console.log(response);

    if (response.result !== "ok") {
      throw new Error(
        "Something went wrong while deleting image from cloudinary"
      );
    }

    return response.result;
  } catch (error) {
    console.log("Error in deleting image file", error);
    return false;
  }
};

export { uploadOnCloudinary, deleteImageFromCloudinary };
