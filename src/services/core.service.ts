import pool from "../config/database.js";
import { AppError } from "../errors/AppError.js";
import type { DistrictData } from "../module/DistrictData.js";
import type { ProvinceData } from "../module/ProvinceData.js";
import type { SubDistrictData } from "../module/SubDistrictData.js";

export async function GetProvinces(): Promise<ProvinceData[]> {
    const result = await pool.query(`SELECT * FROM ct.provinces`);

    if (result.rowCount === 0) {
        throw new AppError("ไม่พบข้อมูลจังหวัด", 404);
    }

    const provinces = result.rows.map((row) => ({
        Id: row.id,
        Name_TH: row.name_th,
        Name_EN: row.name_en
    } as ProvinceData));

    return provinces;
}

export async function GetDistricts(provinceId: string): Promise<DistrictData[]> {
    const result = await pool.query(
        `SELECT * FROM ct.districts WHERE province_id = $1`,
        [provinceId]
    );

    if (result.rowCount === 0) {
        throw new AppError("ไม่พบข้อมูลอำเภอสำหรับจังหวัดนี้", 404);
    }

    const districts = result.rows.map((row) => ({
        Id: row.id,
        ProvinceId: row.province_id,
        Name_TH: row.name_th,
        Name_EN: row.name_en
    } as DistrictData));

    return districts;
}

export async function GetSubDistricts(districtId: string): Promise<SubDistrictData[]> {
    const result = await pool.query(
        `SELECT * FROM ct.sub_districts WHERE district_id = $1`,
        [districtId]
    );

    if (result.rowCount === 0) {
        throw new AppError("ไม่พบข้อมูลตำบลสำหรับอำเภอนี้", 404);
    }

    const subDistricts = result.rows.map((row) => ({
        Id: row.id,
        DistrictId: row.district_id,
        Name_TH: row.name_th,
        Name_EN: row.name_en,
        ZipCode: row.zip_code
    } as SubDistrictData));

    return subDistricts;
}