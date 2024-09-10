import React from 'react';

type FieldType = {
    str?: string | null;
    int?: number | null;
}

const PassportField = ( {str, int}: FieldType ) => {
    return (
        <div className="text-[#222734] font-sans text-base font-normal leading-5">
            <p>{str ?? int?.toString()}</p>
        </div>
    );
};

export default PassportField;
