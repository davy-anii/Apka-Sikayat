import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/urlHelper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image, title, description, category, district } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required for validation." },
        { status: 400 }
      );
    }

    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/validate-grievance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image, title, description, category, district }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || `Backend validation failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI Validation Route error:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during AI validation." },
      { status: 500 }
    );
  }
}
