import type { BaseSearchCriteria } from "./BaseSeachCriteria.js";

export interface SellerSearchCriteria extends BaseSearchCriteria {
    FullName?: string;
    Email?: string;
    Phone?: string;
    SellerStatus?: string;
}