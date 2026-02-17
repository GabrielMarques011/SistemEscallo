import React from 'react';
import IndividualView from '../components/IndividualView';

const CollaboratorDetail = ({ todayData, monthData }) => {
  return (
    <div>
      <IndividualView todayData={todayData} monthData={monthData} />
    </div>
  );
};

export default CollaboratorDetail;