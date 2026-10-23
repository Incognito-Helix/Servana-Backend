import {
  getPendingVendorReviews,
  approveVendorProfile,
  rejectVendorProfile,
} from "../services/vendor.service.js";
import {
  getPendingReviewReports,
  hideReview,
  dismissReviewReport,
} from "../services/reviewModeration.service.js";

export const getPendingVendorReviewsController = async (req, res, next) => {
  try {
    const profiles = await getPendingVendorReviews();

    return res.status(200).json({
      success: true,
      data: { profiles },
    });
  } catch (error) {
    return next(error);
  }
};

export const approveVendorProfileController = async (req, res, next) => {
  try {
    const profile = await approveVendorProfile(req.params.profileId);

    return res.status(200).json({
      success: true,
      message: "Vendor profile approved successfully.",
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

export const rejectVendorProfileController = async (req, res, next) => {
  try {
    const profile = await rejectVendorProfile(
      req.params.profileId,
      req.body.reason,
    );

    return res.status(200).json({
      success: true,
      message: "Vendor profile rejected successfully.",
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all pending review reports
export const getReviewReportsController = async (req, res, next) => {
  try {
    const reports = await getPendingReviewReports();

    return res.status(200).json({ success: true, data: { reports } });
  } catch (error) {
    return next(error);
  }
};

// Hide a reported review
export const hideReviewController = async (req, res, next) => {
  try {
    const result = await hideReview(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: "Review hidden successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// Dismiss a review report
export const dismissReviewReportController = async (req, res, next) => {
  try {
    const result = await dismissReviewReport(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: "Review report dismissed successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
