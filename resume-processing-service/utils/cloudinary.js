const cloudinary = require('cloudinary').v2; //cloudinary library
const fs = require('fs');
const path = require('path')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dgsvoeqsl",
    api_key: process.env.CLOUDINARY_API_KEY || "635435151655556",
    api_secret: process.env.CLOUDINARY_API_SECRET || "-U_oEauANmOtbiLj_EONTYt7vCM"
});

const uploadOnCloudinary = async (localFilePath) => {

    try {

        if (!localFilePath) return null

        //file upload on cloudinary
        console.log("fuploading file on cloudinary", localFilePath)
        
        const response = await cloudinary.uploader.upload(
            localFilePath,
            {
                resource_type: "raw",
                folder: "resume"
            }).catch((error) => {
                console.log("error in uploading file on cloudinary", error)
                return null
            });

        //file has been uploaded successfully 
        console.log('file is uploaded on cloudinary ', response.url)
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        console.error("Cloudinary upload failed:", error.message);
        console.error("Full error:", error);

        throw new Error("Cloudinary upload failed:", error.message);

        fs.unlinkSync(localFilePath) //remove the locally saved temporry file as the upload operation got failed 
        return null
    }

}

module.exports = { uploadOnCloudinary }