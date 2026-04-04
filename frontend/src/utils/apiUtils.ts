export async function handleResponse(res: Response) {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error! status: ${res.status}`);
    }
    return data;
  } else {
    // If it's not JSON, it might be HTML (like a 404 or 500 page)
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}. Response: ${text.substring(0, 100)}...`);
    }
    return text;
  }
}
