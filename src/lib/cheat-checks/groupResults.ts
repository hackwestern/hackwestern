import { CheckDetail, GroupedCheckResult } from "./types";

type Row<TCheckType extends string> = CheckDetail & {
    id: string;
    checkType: TCheckType
}

export function GroupResults<TCheckType extends string, TProfile extends object>(
    rows: Array<Row<TCheckType> & TProfile>,
    allCheckTypes: readonly TCheckType[]
): Array<GroupedCheckResult<TCheckType, TProfile>> {
    const grouped = new Map<string, GroupedCheckResult<TCheckType, TProfile>>();

    //group all cheat types together under one user
    for (const row of rows){
        const {checkType, id, passed, checkedAt, checkedbyName, manualOverride, notes, ... extra} = row;

        if (!grouped.has(id)){
            grouped.set(id, {
                id,
                checks: {},
                finalResult: false,
                ...extra as TProfile
            })
        }

        const entry = grouped.get(id)!;
        const details:CheckDetail = {passed, checkedAt, checkedbyName, manualOverride, notes};
        entry.checks[checkType] = details;
        
    }

    //calculate final result 
    return Array.from(grouped.values()).map((entry => {
        const result = allCheckTypes.every((type) =>{
            const check = entry.checks[type]
            return check?.manualOverride ?? check?.passed ?? false;
        });
        return {...entry, finalResult: result}
    }))

}