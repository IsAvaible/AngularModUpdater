export async function GET(request) {
  try {
    // Get the file URL from query parameters
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return new Response("Missing file URL parameter", {
        status: 400,
      });
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return new Response("Invalid URL format", {
        status: 400,
      });
    }

    // Fetch the file from the provided URL
    const response = await fetch(fileUrl);

    if (!response.ok) {
      return new Response(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      });
    }

    // Extract filename from URL or content-disposition header
    const contentDisposition = response.headers.get("content-disposition");
    let filename = fileUrl.split("/").pop(); // Default to last segment of URL

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=(['"]*)(.*?)\1/,
      );
      if (filenameMatch && filenameMatch[2]) {
        filename = filenameMatch[2];
      }
    } else {
      // Try to extract filename from URL path
      const lastSegment = parsedUrl.pathname.split("/").pop();
      if (lastSegment && lastSegment.includes(".")) {
        filename = lastSegment;
      }
    }

    // Get content type from the original response
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    // Create headers for file download
    const headers = new Headers({
      // File download headers
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    // Add content length if available
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    // Stream the response body
    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error streaming file:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}
