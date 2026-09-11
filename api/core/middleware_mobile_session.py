from django.conf import settings


class MobileSessionMiddleware:
    """Hỗ trợ mobile app gửi sessionid qua header `X-Session-Token` hoặc `Authorization: Bearer`.

    JS runtime trên React Native (Android OkHttp/iOS) có thể bị hạn chế đối với cookie ambient
    hoặc tiêu chuẩn Fetch không cho phép ghi đè header `Cookie`. Mobile app lưu `sessionid` vào
    SecureStore và gửi kèm qua header HTTP.

    Middleware này chạy trước `SessionMiddleware`: nếu request mang header phiên mobile mà
    chưa có cookie `sessionid`, nó sẽ gán vào `request.COOKIES` để Django SessionMiddleware,
    AuthenticationMiddleware và Django Ninja xử lý tự nhiên như phiên duyệt web thông thường.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.SESSION_COOKIE_NAME not in request.COOKIES:
            session_token = (
                request.headers.get("X-Session-Token")
                or request.META.get("HTTP_X_SESSION_TOKEN")
            )
            if not session_token:
                auth_header = (
                    request.headers.get("Authorization")
                    or request.META.get("HTTP_AUTHORIZATION", "")
                )
                if auth_header.startswith("Bearer "):
                    session_token = auth_header[7:].strip()

            if session_token:
                request.COOKIES[settings.SESSION_COOKIE_NAME] = session_token

        return self.get_response(request)
