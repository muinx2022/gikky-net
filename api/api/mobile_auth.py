"""Cửa xác thực dành riêng cho mobile app (React Native / Expo).

Native mobile app không chạy trong ngữ cảnh ambient-cookie của trình duyệt web (không có
nguy cơ CSRF từ tab web khác), và JS runtime của React Native bị hạn chế theo đặc tả Fetch
không cho đọc header `Set-Cookie`.

Endpoint này xác thực tài khoản qua backend của Django/allauth, tạo phiên đăng nhập
chuẩn (session), sinh `csrftoken` và trả thẳng `sessionid` cùng `csrftoken` trong thân JSON để
mobile app lưu trữ và gửi kèm trong các request ghi tới API v1.
"""

import json
from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def dang_nhap_mobile(request: HttpRequest) -> JsonResponse:
    """Đăng nhập dành cho mobile app. Trả sessionid và csrftoken trong JSON."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Phương thức không được hỗ trợ."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"ok": False, "error": "Dữ liệu gửi lên không đúng định dạng JSON."}, status=400)

    dinh_danh = (data.get("tai_khoan") or data.get("username") or data.get("email") or "").strip()
    mat_khau = data.get("mat_khau") or data.get("password") or ""

    if not dinh_danh or not mat_khau:
        return JsonResponse({"ok": False, "error": "Vui lòng nhập tài khoản và mật khẩu."}, status=400)

    # Allauth & Django ModelBackend hỗ trợ xác thực bằng cả username hoặc email
    user = authenticate(request, username=dinh_danh, password=mat_khau)
    if user is None and "@" in dinh_danh:
        from core.models.nguoi_dung import User
        u = User.objects.filter(email__iexact=dinh_danh).first()
        if u:
            user = authenticate(request, username=u.username, password=mat_khau)
    elif user is None:
        from core.models.nguoi_dung import User
        u = User.objects.filter(username__iexact=dinh_danh).first()
        if u:
            user = authenticate(request, username=u.username, password=mat_khau)

    if user is None:
        return JsonResponse({"ok": False, "error": "Tài khoản hoặc mật khẩu không chính xác."}, status=401)

    if not user.is_active:
        return JsonResponse({"ok": False, "error": "Tài khoản đang bị tạm ngưng."}, status=403)

    login(request, user)
    request.session.save()

    csrf_token = get_token(request)
    session_id = request.session.session_key

    return JsonResponse(
        {
            "ok": True,
            "sessionid": session_id,
            "csrftoken": csrf_token,
            "user": {
                "username": user.username,
                "display_name": getattr(user, "display_name", None) or user.username,
                "email": user.email or None,
                "la_staff": bool(user.is_staff),
            },
        }
    )


@csrf_exempt
def dang_xuat_mobile(request: HttpRequest) -> JsonResponse:
    """Đăng xuất phiên mobile."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Phương thức không được hỗ trợ."}, status=405)

    logout(request)
    return JsonResponse({"ok": True})


@csrf_exempt
def dang_ky_mobile(request: HttpRequest) -> JsonResponse:
    """Đăng ký tài khoản mới dành cho mobile app."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Phương thức không được hỗ trợ."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"ok": False, "error": "Dữ liệu gửi lên không đúng định dạng JSON."}, status=400)

    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not email or not username or not password:
        return JsonResponse({"ok": False, "error": "Vui lòng nhập đầy đủ email, tên đăng nhập và mật khẩu."}, status=400)

    if len(username) < 3 or len(username) > 30:
        return JsonResponse({"ok": False, "error": "Tên đăng nhập phải từ 3 đến 30 ký tự."}, status=400)

    import re
    if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
        return JsonResponse({"ok": False, "error": "Tên đăng nhập không được chứa khoảng trắng hoặc ký tự đặc biệt."}, status=400)

    if len(password) < 8:
        return JsonResponse({"ok": False, "error": "Mật khẩu phải có ít nhất 8 ký tự."}, status=400)

    from core.models.nguoi_dung import User
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({"ok": False, "error": "Tên đăng nhập này đã được sử dụng."}, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"ok": False, "error": "Email này đã được sử dụng."}, status=400)

    try:
        user = User.objects.create_user(username=username, email=email, password=password)
        user.display_name = username
        user.save()

        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        request.session.save()

        csrf_token = get_token(request)
        session_id = request.session.session_key

        return JsonResponse(
            {
                "ok": True,
                "sessionid": session_id,
                "csrftoken": csrf_token,
                "user": {
                    "username": user.username,
                    "display_name": user.display_name,
                    "email": user.email,
                    "la_staff": False,
                },
            }
        )
    except Exception as e:
        return JsonResponse({"ok": False, "error": f"Đăng ký thất bại: {str(e)}"}, status=500)


@csrf_exempt
def quen_mat_khau_mobile(request: HttpRequest) -> JsonResponse:
    """Gửi email yêu cầu đặt lại mật khẩu."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Phương thức không được hỗ trợ."}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"ok": False, "error": "Dữ liệu gửi lên không đúng định dạng JSON."}, status=400)

    email = (data.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"ok": False, "error": "Vui lòng nhập email của bạn."}, status=400)

    from django.contrib.auth.forms import PasswordResetForm
    form = PasswordResetForm({"email": email})
    if form.is_valid():
        try:
            form.save(
                request=request,
                use_https=request.is_secure(),
            )
        except Exception:
            pass

    return JsonResponse(
        {
            "ok": True,
            "message": "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục mật khẩu đã được gửi đến hộp thư của bạn.",
        }
    )
