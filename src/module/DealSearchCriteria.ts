import type { BaseSearchCriteria } from "./BaseSeachCriteria.js";

export interface DealSearchCriteria extends BaseSearchCriteria {
    Title?: string;
    SellerName?: string;
    BuyerName?: string;
    DealStatus?: string;
}
