"use client";

import React, { Suspense, lazy } from "react";
import Login from "./Login";

export default function LoginPage() {
    return (
    <div>
      <Suspense fallback={<div>Loading Login Page</div>}>
        <Login />
      </Suspense>
    </div>
  );
}
