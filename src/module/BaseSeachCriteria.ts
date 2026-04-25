export interface BaseSearchCriteria {
    Page: number;
    PageSize: number;
    SortBy: string;
    SortDirection: "ASC" | "DESC";
}