import React, { useEffect, useRef, useState } from "react";
import Requests from "../../../common/requests";
import TypeBadge from "../AllItemsApp/TypeBadge";

const DEBOUNCE_MS = 300;

export default function LandingPreview({ payload }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      Requests.axiosPost("/admin/ajax/aggregation/preview", payload)
        .then((res) => {
          const nextItems = (res && res.data && res.data.items) || [];
          setItems(nextItems);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // Re-run when the filter payload changes (compared by value via stringify).
  }, [JSON.stringify(payload)]);

  return (
    <div className="lh-page-card">
      <div className="lh-page-subtitle flex items-center justify-between">
        <span>Preview</span>
        <span className="text-xs text-gray-400">{items.length} matched</span>
      </div>
      {isLoading && <div className="text-sm text-gray-400">Loading preview...</div>}
      {!isLoading && items.length === 0 && (
        <div className="text-sm text-gray-400">No items match this filter yet.</div>
      )}
      {!isLoading && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <TypeBadge contentType={item.content_type} />
              <span className="text-sm text-gray-700">{item.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
