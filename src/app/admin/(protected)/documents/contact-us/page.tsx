"use client";

import React, { useEffect, useState, useMemo } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, parseISO } from "date-fns";
import Swal from "sweetalert2";

interface Submission {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

// Simple HTML escaper for safe injection into SweetAlert html
const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function ContactUsAdmin() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const data = await post<Submission[]>("/contact/getlist");
        setSubmissions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load submissions.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRowClick = (sub: Submission) => {
    const createdAt = parseISO(sub.createdAt);

    const safeName = escapeHtml(sub.name);
    const safeEmail = escapeHtml(sub.email);
    const safeSubject = escapeHtml(sub.subject || "Contact submission");
    const safeMessage = escapeHtml(sub.message || "").replace(/\n/g, "<br />");

    Swal.fire({
      title: safeSubject,
      icon: "info",
      width: "100%",
      customClass: {
        popup: "max-w-2xl w-full", // responsive width via Tailwind classes
        title: "text-left text-lg font-semibold",
      },
      html: `
        <div class="space-y-4 text-left">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p class="text-sm">
                <span class="font-semibold">From:</span> ${safeName}
              </p>
              <p class="text-sm text-gray-600">${safeEmail}</p>
            </div>
            <div class="text-xs sm:text-right text-gray-500 space-y-1">
              <p>${createdAt.toLocaleString()}</p>
              <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium">
                ${formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>

          <hr class="border-gray-200" />

          <div class="bg-gray-50 rounded-md p-3 max-h-72 overflow-y-auto text-sm leading-relaxed">
            ${safeMessage || "<span class='text-gray-400 italic'>No message provided.</span>"}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Close",
      cancelButtonText: "Reply via email",
      reverseButtons: true,
      focusConfirm: true,
    }).then((result) => {
      // If user clicks "Reply via email"
      if (result.dismiss === Swal.DismissReason.cancel) {
        const subject = `Re: ${sub.subject || "Your message"}`;
        window.location.href = `mailto:${sub.email}?subject=${encodeURIComponent(
          subject
        )}`;
      }
    });
  };

  // Filter & pagination
  const filtered = useMemo(
    () =>
      submissions.filter((sub) =>
        [sub.name, sub.email, sub.subject]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [submissions, searchTerm]
  );

  const total = submissions.length;
  const lastSubmission =
    total > 0
      ? submissions.reduce((prev, curr) =>
          new Date(prev.createdAt) > new Date(curr.createdAt) ? prev : curr
        ).createdAt
      : null;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <p className="text-sm text-gray-600">Loading submissions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex justify-center items-center p-6">
        <p className="text-sm text-gray-500">No submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">
        Contact Us Submissions
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Submissions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {total}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Submission</CardTitle>
          </CardHeader>
          <CardContent>
            {lastSubmission ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  {formatDistanceToNow(parseISO(lastSubmission), {
                    addSuffix: true,
                  })}
                </span>
                <Badge variant="secondary">
                  {new Date(lastSubmission).toLocaleDateString()}
                </Badge>
              </div>
            ) : (
              <span className="text-sm text-gray-500">No submissions</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search name, email or subject…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="min-w-[160px]">Date</TableHead>
              <TableHead className="min-w-[140px]">Name</TableHead>
              <TableHead className="min-w-[200px]">Email</TableHead>
              <TableHead>Subject</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((sub) => (
              <TableRow
                key={sub._id}
                className="even:bg-gray-50 hover:bg-gray-50 cursor-pointer transition"
                onClick={() => handleRowClick(sub)}
              >
                <TableCell className="text-sm">
                  {new Date(sub.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">{sub.name}</TableCell>
                <TableCell className="text-sm">{sub.email}</TableCell>
                <TableCell className="text-sm">{sub.subject}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex flex-wrap justify-center items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
