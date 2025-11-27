'use client';

import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import { post } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'Brand' | 'Influencer';

// Allow mixed types from backend
type FeatureValue =
  | number
  | string
  | string[]
  | { min?: number; max?: number }
  | Record<string, any>;

interface Feature {
  key: string;
  value: FeatureValue;
  note?: string;
}

interface SubscriptionPlan {
  _id: string;
  role: Role;
  name: string;
  displayName?: string;
  monthlyCost: number;
  currency?: string;
  isCustomPricing?: boolean;
  features: Feature[];
  planId: string;
  createdAt: string;
}

const SubscriptionsPage: NextPage = () => {
  const [brandPlans, setBrandPlans] = useState<SubscriptionPlan[]>([]);
  const [influencerPlans, setInfluencerPlans] = useState<SubscriptionPlan[]>([]);
  const [activeRole, setActiveRole] = useState<Role>('Brand');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');
  const [editedCost, setEditedCost] = useState<string>('');
  const [editedFeatures, setEditedFeatures] = useState<Record<string, string>>(
    {}
  );

  // -------- helpers --------

  const formatFeatureValue = (value: FeatureValue | undefined): string => {
    if (value == null) return '-';

    if (typeof value === 'number' || typeof value === 'string') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      const range = value as { min?: number; max?: number };
      const hasMin =
        typeof range.min === 'number' && !Number.isNaN(range.min);
      const hasMax =
        typeof range.max === 'number' && !Number.isNaN(range.max);

      if (hasMin || hasMax) {
        const parts: string[] = [];
        if (hasMin) parts.push(String(range.min));
        if (hasMax) parts.push(String(range.max));
        return parts.join(' – ');
      }

      try {
        return JSON.stringify(value);
      } catch {
        return '[object]';
      }
    }

    return String(value);
  };

  // Fetch plans by role (new endpoint)
  const fetchPlans = async (
    role: Role,
    setter: React.Dispatch<React.SetStateAction<SubscriptionPlan[]>>
  ) => {
    try {
      const response = await post<{ message: string; plans: SubscriptionPlan[] }>(
        '/subscription/list',
        { role }
      );
      setter(response.plans);
    } catch (err) {
      console.error(`Error fetching ${role} plans:`, err);
      setError(`Failed to load ${role} plans.`);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchPlans('Brand', setBrandPlans),
      fetchPlans('Influencer', setInfluencerPlans),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading plans...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const plans = activeRole === 'Brand' ? brandPlans : influencerPlans;
  const featureKeys = Array.from(
    new Set(plans.flatMap((p) => p.features.map((f) => f.key)))
  );

  const startEditing = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan._id);
    setEditedName(plan.name);
    setEditedCost(plan.monthlyCost.toString());

    const initialFeatures: Record<string, string> = {};
    plan.features.forEach((f) => {
      const v = f.value;
      if (v == null) return;
      if (typeof v === 'number' || typeof v === 'string') {
        initialFeatures[f.key] = String(v);
      } else if (Array.isArray(v)) {
        initialFeatures[f.key] = v.join(', ');
      } else if (typeof v === 'object') {
        initialFeatures[f.key] = JSON.stringify(v);
      }
    });
    setEditedFeatures(initialFeatures);
  };

  const cancelEditing = () => {
    setEditingPlanId(null);
    setEditedName('');
    setEditedCost('');
    setEditedFeatures({});
  };

  const saveEditing = async (plan: SubscriptionPlan) => {
    try {
      const parsedCost = parseFloat(editedCost);
      const monthlyCost = Number.isNaN(parsedCost)
        ? plan.monthlyCost
        : parsedCost;

      const updatedFeatures: Feature[] = plan.features.map((f) => {
        const raw = editedFeatures[f.key];

        // If we never touched this feature, keep original as-is
        if (raw == null || raw === '') {
          return f;
        }

        const original = f.value;
        let nextValue: FeatureValue = original;

        if (typeof original === 'number') {
          const n = Number(raw);
          nextValue = Number.isNaN(n) ? original : n;
        } else if (typeof original === 'string') {
          nextValue = raw;
        } else if (Array.isArray(original)) {
          nextValue = raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (original && typeof original === 'object') {
          // Expect JSON for object-like features
          try {
            nextValue = JSON.parse(raw);
          } catch {
            nextValue = original;
          }
        } else {
          nextValue = raw;
        }

        return { ...f, value: nextValue };
      });

      const payload = {
        planId: plan.planId,
        name: editedName.trim() || plan.name,
        monthlyCost,
        features: updatedFeatures,
      };

      // new update endpoint
      await post('/subscription-plans/update', payload);

      // refetch only the active role
      await fetchPlans(
        activeRole,
        activeRole === 'Brand' ? setBrandPlans : setInfluencerPlans
      );
      cancelEditing();
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save changes.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Subscription Plans</h1>

      <Tabs
        value={activeRole}
        onValueChange={(v) => setActiveRole(v as Role)}
        className="bg-white rounded-lg shadow p-2 w-max"
      >
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="Brand" className="text-sm">
            Brand
          </TabsTrigger>
          <TabsTrigger value="Influencer" className="text-sm">
            Influencer
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-auto bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Cost</TableHead>
              {featureKeys.map((key) => (
                <TableHead
                  key={key}
                  className="text-center capitalize text-sm"
                >
                  {key.replace(/_/g, ' ')}
                </TableHead>
              ))}
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => {
              const isEditing = editingPlanId === plan._id;

              return (
                <TableRow key={plan._id}>
                  <TableCell className="font-medium">
                    {isEditing ? (
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-32 mx-auto"
                      />
                    ) : (
                      plan.name
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        value={editedCost}
                        onChange={(e) => setEditedCost(e.target.value)}
                        className="w-24 mx-auto"
                      />
                    ) : (
                      `$${plan.monthlyCost.toFixed(2)}`
                    )}
                  </TableCell>

                  {featureKeys.map((key) => {
                    const feature = plan.features.find((f) => f.key === key);
                    const display = formatFeatureValue(feature?.value);

                    return (
                      <TableCell key={key} className="text-center">
                        {isEditing ? (
                          <Input
                            value={
                              editedFeatures[key] ??
                              (feature ? formatFeatureValue(feature.value) : '')
                            }
                            onChange={(e) =>
                              setEditedFeatures((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="w-24 mx-auto"
                          />
                        ) : (
                          display
                        )}
                      </TableCell>
                    );
                  })}

                  <TableCell className="flex justify-center items-center">
                    {isEditing ? (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveEditing(plan)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(plan)}
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SubscriptionsPage;
