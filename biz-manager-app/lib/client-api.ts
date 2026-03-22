type ApiPayload = {
  message?: string;
  [key: string]: unknown;
};

export async function readApiResponse<T extends ApiPayload = ApiPayload>(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as T | null;
    return {
      data,
      message: typeof data?.message === "string" ? data.message : null,
    };
  }

  const text = await response.text().catch(() => "");
  const looksLikeHtml = /<!doctype html|<html/i.test(text);
  const redirectedToLogin = response.redirected && response.url.includes("/login");

  if (looksLikeHtml || redirectedToLogin) {
    return {
      data: null,
      message: "로그인 세션이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.",
    };
  }

  return {
    data: null,
    message: response.ok ? null : `요청 처리 중 오류가 발생했습니다. (${response.status})`,
  };
}
