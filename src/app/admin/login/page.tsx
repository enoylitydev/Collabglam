// File: app/admin/login/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HiEye, HiEyeSlash } from "react-icons/hi2";
import { post } from "@/lib/api";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Call backend and store JWT in localStorage like other roles
      const data = await post<{ token: string; admin: { adminId: string; email: string } }>(
        "/admin/login",
        { email, password }
      );
      // Use role-scoped token storage for admin
      localStorage.setItem("token", data.token);
      localStorage.setItem("adminId", data.admin.adminId);
      localStorage.setItem("userType", "admin");
      localStorage.setItem("userEmail", data.admin.email || email);
      router.replace("/admin/brands");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 relative">
            <Image
              src="/logo.svg"
              alt="Admin Logo"
              fill
              className="object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Sign In</CardTitle>
          <CardDescription className="text-gray-500">
            Please enter your admin credentials
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-1">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1 relative">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <HiEyeSlash /> : <HiEye />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
          </CardContent>

          <CardFooter className="pt-0">
            <Button
              type="submit"
              className="w-full py-2 text-lg"
              variant="default"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
