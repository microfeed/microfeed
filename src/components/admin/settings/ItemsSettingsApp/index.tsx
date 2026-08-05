import React from "react";

import {showToast} from "@/client/ToastUtils";
import AdminInput from "@/components/admin/shared/AdminInput";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import ExplainText from "@/components/admin/shared/ExplainText";
import {Button} from "@/components/ui/button";
import {
  DEFAULT_ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
  SETTINGS_CATEGORIES,
} from "@/shared/Constants";
import {
  ITEM_ORDERS,
  ITEM_SORTS,
  type ItemOrder,
  type ItemSort,
  resolveItemPaginationSettings,
} from "@/shared/ItemPagination";
import {CONTROLS_TEXTS_DICT, SETTINGS_CONTROLS} from "../FormExplainTexts";
import SettingsBase from "../SettingsBase";

export const ITEMS_ORDERING_SUBMIT_KEY = "items-ordering";
export const ITEMS_PER_PAGE_SUBMIT_KEY = "items-per-page";

export default class ItemsSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    const savedSettings = props.feed.settings?.[
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS
    ] ?? {};
    const {itemsOrder, itemsSort} = resolveItemPaginationSettings(savedSettings);
    const itemsPerPage = savedSettings.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
    this.state = {
      itemsOrder,
      itemsPerPage,
      itemsSort,
      savedItemsPerPage: itemsPerPage,
    };
  }

  async updateOrdering(nextSettings: {
    itemsOrder?: ItemOrder;
    itemsSort?: ItemSort;
  }) {
    const previousSettings = {
      itemsOrder: this.state.itemsOrder as ItemOrder,
      itemsSort: this.state.itemsSort as ItemSort,
    };
    const updatedSettings = {...previousSettings, ...nextSettings};
    this.setState(updatedSettings);
    const saved = await this.props.onSubmit(
      {preventDefault() {}},
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
      updatedSettings,
      [],
      ITEMS_ORDERING_SUBMIT_KEY,
    );
    if (!saved) {
      this.setState(previousSettings);
    }
  }

  render() {
    const {
      itemsOrder,
      itemsPerPage,
      itemsSort,
      savedItemsPerPage,
    } = this.state;
    const {submitting, submitForType, setChanged} = this.props;
    const itemsPerPageChanged = itemsPerPage !== savedItemsPerPage;
    const submittingOrdering = submitForType === ITEMS_ORDERING_SUBMIT_KEY;
    const submittingItemsPerPage = submitForType === ITEMS_PER_PAGE_SUBMIT_KEY;

    return (
      <SettingsBase
        currentType={ITEMS_PER_PAGE_SUBMIT_KEY}
        submitForType={submitForType}
        submitting={submitting}
        title="Items settings"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <AdminRadioGroup
            disabled={submitting}
            labelComponent={<ExplainText
              bundle={CONTROLS_TEXTS_DICT[SETTINGS_CONTROLS.ITEMS_SORT_ORDER]}
              customClass="m-input-label-small"
            />}
            name="items-sort"
            options={[
              {label: "Published at", value: ITEM_SORTS.PUBLISHED_AT},
              {label: "Created at", value: ITEM_SORTS.CREATED_AT},
              {label: "Updated at", value: ITEM_SORTS.UPDATED_AT},
            ]}
            value={itemsSort}
            onValueChange={(value) => void this.updateOrdering({
              itemsSort: value as ItemSort,
            })}
          />
          <AdminRadioGroup
            disabled={submitting}
            label="Order"
            labelClassName="m-input-label-small"
            name="items-order"
            options={[
              {label: "Newest first", value: ITEM_ORDERS.DESC},
              {label: "Oldest first", value: ITEM_ORDERS.ASC},
            ]}
            value={itemsOrder}
            onValueChange={(value) => void this.updateOrdering({
              itemsOrder: value as ItemOrder,
            })}
          />
        </div>

        <div className="mt-6 flex items-end gap-2">
          <div className="w-40 flex-none sm:w-48">
            <AdminInput
              customClass="h-10 text-xs"
              customLabelClass="m-input-label-small"
              extraParams={{min: 0, max: MAX_ITEMS_PER_PAGE}}
              label="Items per page"
              type="number"
              value={itemsPerPage}
              onChange={(event: any) => {
                let nextItemsPerPage = Number.parseInt(event.target.value, 10);
                if (nextItemsPerPage > MAX_ITEMS_PER_PAGE) {
                  nextItemsPerPage = MAX_ITEMS_PER_PAGE;
                  showToast(
                    `Items per page should be less than ${MAX_ITEMS_PER_PAGE}`,
                    "error",
                    5000,
                  );
                } else if (nextItemsPerPage < 0) {
                  showToast(
                    "Items per page should not be a negative number",
                    "error",
                    5000,
                  );
                }
                this.setState(
                  {itemsPerPage: nextItemsPerPage},
                  () => setChanged(),
                );
              }}
            />
          </div>
          {itemsPerPageChanged && (
            <Button
              className="h-10"
              disabled={submittingItemsPerPage || submitting}
              type="button"
              onClick={async (event) => {
                const saved = await this.props.onSubmit(
                  event,
                  SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
                  {itemsPerPage},
                  [],
                  ITEMS_PER_PAGE_SUBMIT_KEY,
                );
                if (saved) {
                  this.setState({savedItemsPerPage: itemsPerPage});
                }
              }}
            >
              {submittingItemsPerPage ? "Updating..." : "Update"}
            </Button>
          )}
        </div>
        {submittingOrdering && (
          <p aria-live="polite" className="mt-4 text-right text-xs text-muted-foreground">
            Saving item order...
          </p>
        )}
      </SettingsBase>
    );
  }
}
