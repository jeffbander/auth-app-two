"use client";

type FilterBarProps = {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClearFilters: () => void;
};

export function FilterBar({
  statusFilter,
  onStatusChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="mr-2 text-sm font-medium text-gray-600">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
        >
          <option value="ALL">All</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETE">Complete</option>
          <option value="NEEDS_REVIEW">Needs Review</option>
          <option value="DENIED_ONLY">Denied</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">DOS:</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          placeholder="From"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          placeholder="To"
        />
      </div>

      <button
        onClick={onClearFilters}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Clear Filters
      </button>
    </div>
  );
}
