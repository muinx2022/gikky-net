"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TextInput,
  PasswordInput,
  Checkbox,
  Paper,
  Title,
  Text,
  Container,
  Group,
  Button,
  LoadingOverlay,
  Alert,
  Box,
} from "@mantine/core";
import { setCookie } from "cookies-next";
import { strapiApi } from "../lib/strapi";

type RoleInfo = { id?: number; name?: string };

type AxiosErrorLike = {
  response?: {
    data?: {
      error?: {
        message?: unknown;
      };
    };
  };
};

function getRoleInfo(user: unknown): RoleInfo {
  if (!user || typeof user !== "object") return {};

  const anyUser = user as Record<string, unknown>;
  const role = anyUser.role;

  if (!role || typeof role !== "object") {
    if (typeof role === "number") return { id: role };
    return {};
  }

  const anyRole = role as Record<string, unknown>;

  const directName =
    (typeof anyRole.name === "string" && anyRole.name) ||
    (typeof anyRole.type === "string" && anyRole.type) ||
    undefined;

  const directId = typeof anyRole.id === "number" ? anyRole.id : undefined;

  const data = anyRole.data;
  if (data && typeof data === "object") {
    const anyData = data as Record<string, unknown>;
    const dataId = typeof anyData.id === "number" ? anyData.id : undefined;
    const attrs = anyData.attributes;
    if (attrs && typeof attrs === "object") {
      const anyAttrs = attrs as Record<string, unknown>;
      const attrName =
        (typeof anyAttrs.name === "string" && anyAttrs.name) ||
        (typeof anyAttrs.type === "string" && anyAttrs.type) ||
        undefined;
      return { id: dataId ?? directId, name: attrName ?? directName };
    }
    return { id: dataId ?? directId, name: directName };
  }

  return { id: directId, name: directName };
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate with Strapi
      const response = await strapiApi.post("/api/auth/local", {
        identifier,
        password,
      });

      const { jwt, user } = response.data;

      // 2. Fetch user data with role to verify if they are an admin.
      // NOTE: Standard 'Authenticated' role often doesn't have permission to view /api/users/me unless configured in Strapi settings.
      // However, we can try to use the 'user' object from login response if it has the role, or fall back to a safer check.
      // Usually, the login response `user` object does NOT contain the deep role relation unless configured.
      
      // If /api/users/me is 403, it means the Authenticated role doesn't have "find" or "me" permission for Users-Permissions plugin.
      // Let's assume for this specific task that we might need to rely on the server configuration or use a try-catch to handle the permission error gracefully,
      // possibly assuming success if login worked but warning about role check failure, OR guiding the user to enable the permission.
      
      // But a more robust frontend approach if we can't change backend settings right now:
      // Try to fetch me. If fails 403, check if the login user object has role (sometimes it does).
      // If not, we might have to let them in and let the dashboard API calls fail if they aren't admin.
      
      // Let's try to handle the 403 by proceeding if we can't verify role, or strict check.
      // Given the requirement "check với role admin", we must check it.
      // The 403 likely means the user IS logged in but doesn't have permission to see their own full details.
      
      let userWithRole = user;

      // Try multiple methods to get role information
      try {
          // Method 1: Try with populate=role
          const userResponse = await strapiApi.get("/api/users/me", {
            params: { populate: "role" },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          });
          userWithRole = userResponse.data;
      } catch (roleError: unknown) {
          console.warn("Method 1 failed (populate=role). Trying alternative methods...", roleError);

          // Method 2: Try without populate (might still have role as ID)
          try {
              const userResponse = await strapiApi.get("/api/users/me", {
                headers: {
                  Authorization: `Bearer ${jwt}`,
                },
              });
              userWithRole = userResponse.data;
          } catch (secondError: unknown) {
              console.warn("Method 2 failed (/api/users/me). Using login response user object.", secondError);
              // Method 3: Use user from login response if it has role
              if (!user.role) {
                  throw new Error(
                    "Access denied: Unable to verify Admin role.\n\n" +
                    "Please configure Strapi permissions:\n" +
                    "1. Go to Settings → Users & Permissions → Roles\n" +
                    "2. Select your 'Admin' role\n" +
                    "3. Under 'Users-permissions' section, enable:\n" +
                    "   ✓ find\n" +
                    "   ✓ findOne\n" +
                    "   ✓ me\n" +
                    "4. Save changes and try again."
                  );
              }
          }
      }

      
      // Check if user has admin role (Strapi can return role in different shapes)
      const extractedRole = getRoleInfo(userWithRole);
      let roleName = extractedRole.name;

      if (!roleName && extractedRole.id) {
        try {
          const roleResponse = await strapiApi.get(
            `/api/users-permissions/roles/${extractedRole.id}`,
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
          const resolved = roleResponse.data?.role ?? roleResponse.data;
          roleName =
            typeof resolved?.name === "string"
              ? resolved.name
              : typeof resolved?.type === "string"
                ? resolved.type
                : undefined;
        } catch {
          // ignore; handled below
        }
      }

      const roleNameLower = roleName?.trim().toLowerCase();
      const allowedRoleNames = new Set(["admin", "super admin", "administrator"]);

      if (!roleNameLower) {
        throw new Error(
          "Access denied: Unable to verify Admin role. (In Strapi: Settings -> USERS & PERMISSIONS PLUGIN -> Roles -> <your role> (e.g. Admin) -> enable 'User: me' permission, or ensure the API returns role info.)"
        );
      }

      if (!allowedRoleNames.has(roleNameLower)) {
        throw new Error(
          `You do not have permission to access the admin dashboard. (Role: ${roleName})`
        );
      }

      // 3. Store the token and user
      const cookieOptions = rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}; // 30 days if remember me
      setCookie("token", jwt, cookieOptions);
      setCookie("user", JSON.stringify(userWithRole), cookieOptions);

      // 4. Redirect to dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error(err);
      const errorMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as AxiosErrorLike).response?.data?.error?.message === "string"
          ? ((err as AxiosErrorLike).response?.data?.error?.message as string)
          : err instanceof Error
            ? err.message
            : "An error occurred during login. Please try again.";
      setError(
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
      }}
    >
        <Container size={420} w="100%" className="animate-fade-in">
        <Box
          style={{
            textAlign: "center",
            marginBottom: "2.5rem",
          }}
        >
          <Box
            style={{
              width: "48px",
              height: "48px",
              background: "#475569",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
          >
            <Text size="24px" fw={900} style={{ color: "white" }}>
              R
            </Text>
          </Box>
          <Title ta="center" fw={700} style={{ color: "#334155", fontSize: "1.75rem", marginBottom: "0.5rem" }}>
              Refne Admin
          </Title>
          <Text c="#64748b" size="sm" ta="center">
              Sign in to your account
          </Text>
        </Box>

        <Paper
          shadow="sm"
          p={32}
          radius="xl"
          pos="relative"
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
          }}
        >
            <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />

            {error && (
            <Alert color="red" mb="md" variant="light" radius="md">
                {error}
            </Alert>
            )}

            <form onSubmit={handleLogin}>
            <TextInput
                placeholder="Email or Username"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.currentTarget.value)}
                radius="lg"
                size="md"
                styles={{
                  input: {
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#fafafa",
                    "&:focus": {
                      borderColor: "#0f172a",
                      backgroundColor: "white",
                    },
                  },
                }}
            />
            <PasswordInput
                placeholder="Password"
                required
                mt="md"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                radius="lg"
                size="md"
                styles={{
                  input: {
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#fafafa",
                    "&:focus": {
                      borderColor: "#0f172a",
                      backgroundColor: "white",
                    },
                  },
                }}
            />
            <Group justify="space-between" mt="lg">
                <Checkbox
                label="Remember me"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.currentTarget.checked)}
                color="gray"
                />
            </Group>
            <Button
              fullWidth
              mt="xl"
              type="submit"
              size="md"
              radius="lg"
              styles={{
                root: {
                  backgroundColor: "#475569",
                  "&:hover": {
                    backgroundColor: "#334155",
                  },
                },
              }}
            >
                Sign in
            </Button>
            </form>
        </Paper>
        </Container>
    </Box>
  );
}
