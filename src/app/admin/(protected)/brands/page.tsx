"use client";

import React, { useState, useEffect } from "react";
import { NextPage } from "next";
import Link from "next/link";
import { post } from "@/lib/api";
import { HiOutlineRefresh, HiOutlineEye, HiChevronUp, HiChevronDown, HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

// Domain types
interface Subscription {
  planName: string;
  expiresAt: string;
}

export interface Brand {
  brandId: string;
  name: string;
  email: string;
  callingcode?: string;
  phone?: string;
  subscriptionExpired: boolean;
  subscription: Subscription;
}

interface GetListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  brands: Brand[];
}

const SORTABLE_FIELDS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  planName: "Plan",
  expiresAt: "Expires",
  subscriptionExpired: "Status",
};

const AdminBrandsPage: NextPage = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, search, sortBy, sortOrder };
      const response = await post<GetListResponse>("/admin/brand/getlist", params);
      setBrands(response.brands);
      setTotal(response.total);
      setPage(response.page);
      setPageSize(response.limit);
      setTotalPages(response.totalPages)
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load brands.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [page, pageSize, search, sortBy, sortOrder]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Brands Administration</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, email, plan..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full sm:w-64"
          />
          <Button variant="outline" onClick={fetchBrands} disabled={loading}>
            <HiOutlineRefresh className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <Card className="text-red-600 p-4">{error}</Card>}

      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => toggleSort("name")} className="cursor-pointer">
                <div className="flex items-center justify-center">
                  Name{sortBy === "name" && (sortOrder === "asc" ? <HiChevronUp /> : <HiChevronDown />)}
                </div>
              </TableHead>
              <TableHead onClick={() => toggleSort("email")} className="cursor-pointer">
                <div className="flex items-center justify-center">
                  Email{sortBy === "email" && (sortOrder === "asc" ? <HiChevronUp /> : <HiChevronDown />)}
                </div>
              </TableHead>
              <TableHead onClick={() => toggleSort("phone")} className="cursor-pointer">
                <div className="flex items-center justify-center">
                  Phone{sortBy === "phone" && (sortOrder === "asc" ? <HiChevronUp /> : <HiChevronDown />)}
                </div>
              </TableHead>
              <TableHead onClick={() => toggleSort("planName")} className="cursor-pointer">
                <div className="flex items-center justify-center">
                  Plan{sortBy === "planName" && (sortOrder === "asc" ? <HiChevronUp /> : <HiChevronDown />)}
                </div>
              </TableHead>
              <TableHead onClick={() => toggleSort("expiresAt")} className="cursor-pointer">
                <div className="flex items-center  justify-center">
                  Expires{sortBy === "expiresAt" && (sortOrder === "asc" ? <HiChevronUp /> : <HiChevronDown />)}
                </div>
              </TableHead>
              <TableHead onClick={() => toggleSort("subscriptionExpired")} className="cursor-pointer">
                <div className="flex items-center justify-center">
                  Status{sortBy === "subscriptionExpired" && (sortOrder === "asc" ? <HiChevronUp /> : <HiChevronDown />)}
                </div>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
              : brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No brands match the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                brands.map(b => (
                  <TableRow key={b.brandId}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.email}</TableCell>
                    <TableCell>{b.callingcode ? `${b.callingcode} ${b.phone}` : b.phone}</TableCell>
                    <TableCell>{b.subscription.planName}</TableCell>
                    <TableCell>{new Date(b.subscription.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={b.subscriptionExpired ? "text-red-600" : "text-green-600"}>
                        {b.subscriptionExpired ? "Expired" : "Active"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/admin/brands/view?brandId=${b.brandId}`}>
                            <Button variant="ghost" size="icon">
                              <HiOutlineEye />
                            </Button>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>View details</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </Card>

      {!loading && !error && brands.length > 0 && (
        <div className="flex justify-between items-center p-4">
          <div className="text-sm text-gray-700">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>
              <HiChevronLeft />
            </Button>
            <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>
              <HiChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBrandsPage;