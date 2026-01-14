"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  HiSearch,
  HiDownload,
  HiChevronLeft,
  HiChevronRight,
  HiOfficeBuilding,
  HiUser,
  HiFilter,
  HiRefresh,
  HiDocumentText,
  HiCreditCard,
} from "react-icons/hi";
import Swal from "sweetalert2";

// Utils & API Helper
import { post } from "@/lib/api";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ===================== TYPES ===================== */

type PaymentRow = {
  _id: string;
  orderId: string;
  paymentId: string;
  amount: number; // cents
  currency: string;
  status: "created" | "paid" | "failed";
  planName: string;
  role: "Brand" | "Influencer";
  userId: string;
  userName: string; // Enriched Name
  invoiceNumber: string;
  invoiceEmailTo: string;
  createdAt: string;
  paidAt?: string;
};

type PaymentResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  payments: PaymentRow[];
};

/* ===================== FORMATTERS ===================== */

const formatCurrency = (amount: number, currency = "USD") => {
  // Backend returns cents (e.g., 100 = $1.00)
  const val = amount / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(val);
};

const formatDate = (isoString?: string) => {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ===================== COMPONENT ===================== */

export default function AdminPaymentsPage() {
  // Data State
  const [data, setData] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Pagination & Filter State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10); // ✅ Dynamic Limit State
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Data
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await post<PaymentResponse>("/admin/getpayments", {
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter === "all" ? undefined : statusFilter,
        role: roleFilter === "all" ? undefined : roleFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (res) {
        setData(res.payments || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 0);
      }
    } catch (error: any) {
      console.error(error);
      Swal.fire("Error", error?.message || "Failed to fetch payments", "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, roleFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Download Handler
  const handleDownload = async (invoiceNumber: string) => {
    if (!invoiceNumber || invoiceNumber === "-" || invoiceNumber === "N/A") {
      Swal.fire("Info", "No invoice number available for this transaction.", "info");
      return;
    }

    setDownloadingId(invoiceNumber);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "";
      
      const baseUrl = API_BASE.replace(/\/$/, "");
      const url = `${baseUrl}/payment/generate-invoice`;

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invoiceNumber }),
      });

      if (!resp.ok) throw new Error("Failed to generate PDF");

      const blob = await resp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

    } catch (error: any) {
      console.error(error);
      Swal.fire("Error", "Could not download invoice. Please try again.", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  // UI Helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "failed": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getRoleIcon = (role: string) => {
    return role === "Brand" ? (
      <HiOfficeBuilding className="w-4 h-4 text-orange-500" />
    ) : (
      <HiUser className="w-4 h-4 text-blue-500" />
    );
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50">
      {/* Header Stats / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
            <HiCreditCard className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payments & Invoices</h1>
            <p className="text-sm text-gray-500">
              Manage transactions, view status, and download invoices.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" onClick={fetchPayments} className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300">
             <HiRefresh className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
             Refresh
           </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search */}
            <div className="md:col-span-6 relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input 
                placeholder="Search Order ID, Invoice #, Plan or Name..." 
                className="pl-10 h-10 bg-white border-gray-200 focus:bg-white transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter - ✅ Added bg-white */}
            <div className="md:col-span-3">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="h-10 bg-white border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600">
                     <HiFilter className="w-4 h-4" />
                     <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="created">Created (Pending)</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter - ✅ Added bg-white */}
            <div className="md:col-span-3">
              <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
                <SelectTrigger className="h-10 bg-white border-gray-200">
                   <div className="flex items-center gap-2 text-gray-600">
                     <HiUser className="w-4 h-4" />
                     <SelectValue placeholder="User Role" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Brand">Brand</SelectItem>
                  <SelectItem value="Influencer">Influencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border border-gray-200 shadow-sm bg-white overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Plan / Amount</th>
                <th className="px-6 py-4">Invoice Info</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded mb-2"></div><div className="h-3 w-20 bg-gray-50 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-100 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-gray-100 rounded"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-6 w-16 bg-gray-100 rounded-full mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-8 w-8 bg-gray-100 rounded ml-auto"></div></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <HiDocumentText className="w-10 h-10 opacity-20" />
                       <p className="font-medium">No payment records found.</p>
                       <p className="text-xs">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-9 h-9 border border-gray-200 shadow-sm">
                          <AvatarFallback className={`text-xs font-bold ${item.role === 'Brand' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
                             {item.userName ? item.userName.charAt(0).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">{item.userName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                             {getRoleIcon(item.role)}
                             <span className="text-xs text-gray-500">{item.role}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-[180px]" title={item.invoiceEmailTo}>
                            {item.invoiceEmailTo}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-base tabular-nums">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1 inline-flex items-center gap-1">
                          {item.planName || "One-time"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 align-top">
                       <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                              Invoice No.:  {item.invoiceNumber || "N/A"}
                             </span>
                          </div>
                          <div className="text-xs text-gray-500 flex flex-col gap-0.5">
                             <span>Created: {formatDate(item.createdAt)}</span>
                             {item.paidAt && (
                               <span className="text-emerald-600">Paid: {formatDate(item.paidAt)}</span>
                             )}
                          </div>
                       </div>
                    </td>

                    <td className="px-6 py-4 align-top text-center">
                      <Badge className={`${getStatusColor(item.status)} capitalize shadow-none px-2.5 py-0.5 rounded-full`}>
                        {item.status}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 align-middle text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 border-gray-200 text-gray-700 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-all disabled:opacity-50"
                        disabled={!item.invoiceNumber || item.invoiceNumber === '-' || downloadingId === item.invoiceNumber}
                        onClick={() => handleDownload(item.invoiceNumber)}
                      >
                         {downloadingId === item.invoiceNumber ? (
                           <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                         ) : (
                           <HiDownload className="w-4 h-4 mr-2" />
                         )}
                         {downloadingId === item.invoiceNumber ? "Generating..." : "Invoice"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: Pagination & Limit */}
        {!loading && total > 0 && (
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Left: Info & Limit Selector */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <p>
                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{" "}
                <span className="font-medium">{Math.min(page * limit, total)}</span> of{" "}
                <span className="font-medium">{total}</span> results
              </p>
              
              <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
                <span>Rows:</span>
                <Select 
                  value={limit.toString()} 
                  onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-[70px] bg-white border-gray-200">
                    <SelectValue placeholder={limit.toString()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right: Pagination Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 p-0 bg-white"
              >
                <HiChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded border border-gray-200 min-w-[100px] text-center">
                 Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 p-0 bg-white"
              >
                <HiChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}