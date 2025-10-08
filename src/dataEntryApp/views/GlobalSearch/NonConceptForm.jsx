import { Fragment } from "react";
import { styled } from "@mui/material/styles";
import { Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTranslation } from "react-i18next";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { dateFormat } from "dataEntryApp/constants";

const StyledGrid = styled(Grid)({
  marginTop: "1%",
  marginBottom: "1%",
});

const StyledTypography = styled(Typography)({
  marginBottom: 10,
  color: "rgba(0, 0, 0, 0.54)",
});

function NonConceptForm({
  searchFilterForms = [],
  selectedDate,
  onDateChange,
}) {
  const { t } = useTranslation();

  return searchFilterForms ? (
    <Fragment key={searchFilterForms.uuid}>
      <StyledGrid container spacing={3}>
        {searchFilterForms.map((searchFilterForm, index) =>
          (searchFilterForm.type === "RegistrationDate" ||
            searchFilterForm.type === "EnrolmentDate" ||
            searchFilterForm.type === "ProgramEncounterDate" ||
            searchFilterForm.type === "EncounterDate") &&
          searchFilterForm.widget === "Default" ? (
            <Grid key={index} size={12}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <StyledTypography variant="body1" sx={{ mb: 1 }}>
                  {t(searchFilterForm.titleKey)}
                </StyledTypography>
                <DatePicker
                  id="date-picker-dialog"
                  format={dateFormat}
                  value={
                    selectedDate[`${searchFilterForm.type}`].minValue
                      ? new Date(
                          selectedDate[`${searchFilterForm.type}`].minValue,
                        )
                      : null
                  }
                  onChange={(minDate) =>
                    onDateChange(minDate, null, searchFilterForm.type)
                  }
                  slotProps={{
                    textField: { variant: "outlined" },
                    actionBar: { actions: ["clear"] },
                    openPickerButton: {
                      "aria-label": "change date",
                      color: "primary",
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid>
          ) : (searchFilterForm.type === "RegistrationDate" ||
              searchFilterForm.type === "EnrolmentDate" ||
              searchFilterForm.type === "ProgramEncounterDate" ||
              searchFilterForm.type === "EncounterDate") &&
            searchFilterForm.widget === "Range" ? (
            <Grid key={index} size={12}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <StyledTypography variant="body1" sx={{ mb: 1 }}>
                  {t(searchFilterForm.titleKey)}
                </StyledTypography>
                <DatePicker
                  id="date-picker-dialog"
                  format={dateFormat}
                  placeholder="From"
                  value={
                    selectedDate[`${searchFilterForm.type}`].minValue
                      ? new Date(
                          selectedDate[`${searchFilterForm.type}`].minValue,
                        )
                      : null
                  }
                  onChange={(minDate) =>
                    onDateChange(
                      minDate,
                      selectedDate[`${searchFilterForm.type}`].maxValue !== null
                        ? new Date(
                            selectedDate[`${searchFilterForm.type}`].maxValue,
                          )
                        : null,
                      searchFilterForm.type,
                    )
                  }
                  slotProps={{
                    textField: { placeholder: "From", variant: "outlined" },
                    actionBar: { actions: ["clear"] },
                    openPickerButton: {
                      "aria-label": "change date",
                      color: "primary",
                    },
                  }}
                />
                <DatePicker
                  id="date-picker-dialog"
                  format={dateFormat}
                  placeholder="To"
                  value={
                    selectedDate[`${searchFilterForm.type}`].maxValue
                      ? new Date(
                          selectedDate[`${searchFilterForm.type}`].maxValue,
                        )
                      : null
                  }
                  onChange={(maxDate) =>
                    onDateChange(
                      selectedDate[`${searchFilterForm.type}`].minValue !== null
                        ? new Date(
                            selectedDate[`${searchFilterForm.type}`].minValue,
                          )
                        : null,
                      maxDate,
                      searchFilterForm.type,
                    )
                  }
                  slotProps={{
                    textField: { placeholder: "To", variant: "outlined" },
                    actionBar: { actions: ["clear"] },
                    openPickerButton: {
                      "aria-label": "change date",
                      color: "primary",
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid>
          ) : null,
        )}
      </StyledGrid>
    </Fragment>
  ) : null;
}

export default NonConceptForm;
