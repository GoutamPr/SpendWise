
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
  Download,
  FileChartColumn,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";

type Transaction = {
  id: string;
  user_id: string;
  title: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  transaction_date: string;
  note: string | null;
  created_at: string;
};

const categories = {
  income: [
    "Salary",
    "Freelance",
    "Business",
    "Investment",
    "Gift",
    "Other",
  ],
  expense: [
    "Food",
    "Shopping",
    "Transport",
    "Bills",
    "Education",
    "Entertainment",
    "Health",
    "Rent",
    "Other",
  ],
};

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const initialForm = {
  title: "",
  type: "expense" as "income" | "expense",
  category: "Food",
  amount: "",
  transaction_date: today(),
  note: "",
};

function csvCell(value: string | number) {
  let text = String(value ?? "");

  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = "\uFEFF" + rows
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async () => {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/login");
      return;
    }

    setUserId(userData.user.id);
    const savedCurrency = userData.user.user_metadata?.currency;
    setCurrencyCode(
      typeof savedCurrency === "string" && savedCurrency.trim()
        ? savedCurrency
        : "INR"
    );

    const { data, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
      setError("");
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const filteredTransactions = transactions.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.note ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesType =
      typeFilter === "all" || item.type === typeFilter;

    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const availableCategories =
    typeFilter === "all"
      ? [...new Set(Object.values(categories).flat())]
      : categories[typeFilter as keyof typeof categories];

  function openAddModal() {
    setEditingId(null);
    setForm(initialForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(item: Transaction) {
    setEditingId(item.id);

    setForm({
      title: item.title,
      type: item.type,
      category: item.category,
      amount: String(item.amount),
      transaction_date: item.transaction_date,
      note: item.note ?? "",
    });

    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid title and an amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      title: form.title.trim(),
      type: form.type,
      category: form.category,
      amount,
      transaction_date: form.transaction_date,
      note: form.note.trim() || null,
      user_id: userId,
    };

    const result = editingId
      ? await supabase
          .from("transactions")
          .update({
            title: payload.title,
            type: payload.type,
            category: payload.category,
            amount: payload.amount,
            transaction_date: payload.transaction_date,
            note: payload.note,
          })
          .eq("id", editingId)
          .eq("user_id", userId)
      : await supabase.from("transactions").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSaving(false);
    await loadTransactions();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadTransactions();
  }

  function exportTransactions() {
    if (filteredTransactions.length === 0) {
      alert("No transactions available to export.");
      return;
    }

    const rows: (string | number)[][] = [
      [
        "Transaction ID",
        "Title",
        "Type",
        "Category",
        `Amount (${currencyCode})`,
        "Date",
        "Note",
      ],
      ...filteredTransactions.map((item) => [
        item.id,
        item.title,
        item.type,
        item.category,
        Number(item.amount).toFixed(2),
        item.transaction_date,
        item.note ?? "",
      ]),
    ];

    downloadCSV(
      `SpendWise_Transactions_${today()}.csv`,
      rows
    );
  }

  function exportSummary() {
    const categoryTotals = transactions
      .filter((item) => item.type === "expense")
      .reduce((result, item) => {
        result[item.category] =
          (result[item.category] || 0) + Number(item.amount);

        return result;
      }, {} as Record<string, number>);

    const rows: (string | number)[][] = [
      ["SpendWise Financial Summary"],
      ["Report Date", today()],
      [],
      ["Financial Metric", `Amount (${currencyCode})`],
      ["Total Income", income.toFixed(2)],
      ["Total Expenses", expenses.toFixed(2)],
      ["Net Balance", (income - expenses).toFixed(2)],
      ["Total Transactions", transactions.length],
      [],
      ["Expense Category", `Total Amount (${currencyCode})`],
      ...Object.entries(categoryTotals).map(([category, amount]) => [
        category,
        amount.toFixed(2),
      ]),
    ];

    downloadCSV(
      `SpendWise_Summary_${today()}.csv`,
      rows
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1120] px-4 py-6 text-slate-100 md:px-8">

      <div className="mx-auto max-w-7xl">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">

          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold">
              Transactions
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Manage and track all your financial transactions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportTransactions}
              disabled={filteredTransactions.length === 0}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={17} />
              Export CSV
            </button>

            <button
              onClick={exportSummary}
              className="flex items-center gap-2 rounded-xl border border-indigo-500/40 px-4 py-3 text-sm text-indigo-300 transition hover:bg-indigo-500/10"
            >
              <FileChartColumn size={17} />
              Summary
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium transition hover:bg-indigo-500"
            >
              <Plus size={19} />
              Add Transaction
            </button>
          </div>

        </header>

        <section className="mb-8 grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Income</p>
              <TrendingUp className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-400">
              {formatCurrency(income, currencyCode)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Expenses</p>
              <TrendingDown className="text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold text-rose-400">
              {formatCurrency(expenses, currencyCode)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Net Balance</p>
              <Wallet className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold">
              {formatCurrency(income - expenses, currencyCode)}
            </h2>
          </div>

        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#151e30]">

          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center">

            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={18}
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions..."
                className="w-full rounded-xl border border-slate-700 bg-[#0b1120] py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCategoryFilter("all");
              }}
              className="rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

          </div>

          {error && (
            <div className="m-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-16 text-slate-400">
              <Loader2 className="animate-spin" />
              Loading transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800">
                <Wallet className="text-indigo-400" size={26} />
              </div>

              <h3 className="text-lg font-semibold">
                No transactions found
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Add your first transaction or change your filters.
              </p>

              <button
                onClick={openAddModal}
                className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500"
              >
                Add Transaction
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left">

                <thead className="bg-slate-800/40 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Transaction</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 transition hover:bg-slate-800/20"
                    >
                      <td className="px-6 py-5">
                        <p className="font-medium">{item.title}</p>
                        {item.note && (
                          <p className="mt-1 text-xs text-slate-500">
                            {item.note}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                          {item.category}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-400">
                        {new Date(
                          item.transaction_date + "T00:00:00"
                        ).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td
                        className={`px-6 py-5 text-right font-semibold ${
                          item.type === "income"
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {item.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(item.amount), currencyCode)}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => openEditModal(item)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-500/10 hover:text-indigo-400"
                            aria-label="Edit transaction"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label="Delete transaction"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

          <div className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>

        </section>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">

            <div className="my-auto w-full max-w-lg rounded-2xl border border-slate-700 bg-[#151e30] p-6 shadow-2xl">

              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {editingId ? "Edit Transaction" : "Add Transaction"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Enter your transaction details.
                  </p>
                </div>

                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                  aria-label="Close form"
                >
                  <X />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Transaction Type
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {(["expense", "income"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            type,
                            category: categories[type][0],
                          })
                        }
                        className={`rounded-xl border py-3 text-sm font-medium capitalize transition ${
                          form.type === type
                            ? type === "income"
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                              : "border-rose-500 bg-rose-500/10 text-rose-400"
                            : "border-slate-700 text-slate-400"
                        }`}
                      >
                        {type === "income" ? "Income" : "Expense"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Transaction Title
                  </label>

                  <input
                    required
                    maxLength={100}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="e.g. Monthly groceries"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Amount ({currencyCode})
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      {currencyCode}
                    </span>

                    <input
                      required
                      type="number"
                      min="0.01"
                      max="9999999999.99"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      placeholder="Enter amount"
                      className="w-full rounded-xl border border-slate-700 bg-[#0b1120] py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">
                      Category
                    </label>

                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                    >
                      {categories[form.type].map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-300">
                      Date
                    </label>

                    <input
                      required
                      type="date"
                      max={today()}
                      value={form.transaction_date}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          transaction_date: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Note (Optional)
                  </label>

                  <textarea
                    rows={3}
                    maxLength={500}
                    value={form.note}
                    onChange={(e) =>
                      setForm({ ...form, note: e.target.value })
                    }
                    placeholder="Add additional details..."
                    className="w-full resize-none rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving && (
                      <Loader2 size={17} className="animate-spin" />
                    )}

                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Update Transaction"
                        : "Save Transaction"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
