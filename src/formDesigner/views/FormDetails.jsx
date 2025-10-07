import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import _, { cloneDeep, isEmpty, replace, split } from "lodash";
import { httpClient as http } from "common/utils/httpClient";
import { Grid, Button, FormControl } from "@mui/material";
import FormElementGroup from "../components/FormElementGroup";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import CustomizedSnackbar from "../components/CustomizedSnackbar";
import { DragDropContext, Droppable } from "react-beautiful-dnd";
import { produce } from "immer";
import Box from "@mui/material/Box";
import { Title, useRecordContext } from "react-admin";
import TextField from "@mui/material/TextField";
import FormHelperText from "@mui/material/FormHelperText";
import { Navigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { SaveComponent } from "../../common/components/SaveComponent";
import FormLevelRules from "../components/FormLevelRules";
import { SystemInfo } from "../components/SystemInfo";
import StaticFormElementGroup from "../components/StaticFormElementGroup";
import { DeclarativeRuleHolder } from "rules-config";
import FormDesignerContext from "./FormDesignerContext";
import {
  formDesignerAddFormElement,
  formDesignerAddFormElementGroup,
  formDesignerDeleteFormElement,
  formDesignerDeleteGroup,
  formDesignerHandleConceptFormLibrary,
  formDesignerHandleExcludedAnswers,
  formDesignerHandleGroupElementChange,
  formDesignerHandleGroupElementKeyValueChange,
  formDesignerHandleInlineCodedAnswerAddition,
  formDesignerHandleInlineCodedConceptAnswers,
  formDesignerHandleInlineConceptAttributes,
  formDesignerHandleInlineNumericAttributes,
  formDesignerHandleModeForDate,
  formDesignerHandleRegex,
  formDesignerOnConceptAnswerAlphabeticalSort,
  formDesignerOnConceptAnswerMoveDown,
  formDesignerOnConceptAnswerMoveUp,
  formDesignerOnDeleteInlineConceptCodedAnswerDelete,
  formDesignerOnSaveInlineConcept,
  formDesignerOnToggleInlineConceptCodedAnswerAttribute,
  formDesignerUpdateConceptElementData,
  formDesignerUpdateDragDropOrderForFirstGroup,
} from "../common/FormDesignerHandlers";
import { FormTypeEntities } from "../common/constants";
import UserInfo from "../../common/model/UserInfo";
import { Concept } from "openchs-models";
import { SubjectTypeType } from "../../adminApp/SubjectType/Types";
import { multiSelectFormElementConceptDataTypes } from "../components/FormElementDetails";

export const isNumeric = (concept) => concept.dataType === "Numeric";

export const isText = (concept) => concept.dataType === "Text";

export const areValidFormatValuesValid = (formElement) => {
  if (!isNumeric(formElement.concept) && !isText(formElement.concept))
    return true;
  if (!formElement.validFormat) return true;
  return (
    isEmpty(formElement.validFormat.regex) ===
    isEmpty(formElement.validFormat.descriptionKey)
  );
};

export function TabContainer({ children, ...rest }) {
  const typographyCSS = { padding: 4 };
  return (
    <Typography {...rest} component="div" sx={typographyCSS}>
      {children}
    </Typography>
  );
}

TabContainer.propTypes = {
  children: PropTypes.node.isRequired,
};

const personStaticFormElements = [
  { name: "First name", dataType: Concept.dataType.Text },
  { name: "Last name", dataType: Concept.dataType.Text },
  { name: "Date of birth", dataType: Concept.dataType.Date },
  { name: "Age", dataType: Concept.dataType.Numeric },
  { name: "Gender", dataType: Concept.dataType.Coded },
  { name: "Address", dataType: Concept.dataType.Coded },
];

const nonPersonStaticFormElements = [
  { name: "Name", dataType: Concept.dataType.Text },
  { name: "Address", dataType: Concept.dataType.Coded },
];

const householdStaticFormElements = [
  { name: "Name", dataType: Concept.dataType.Text },
  { name: "Total members", dataType: Concept.dataType.Numeric },
  { name: "Address", dataType: Concept.dataType.Coded },
];

const userStaticFormElements = [
  { name: "First name", dataType: Concept.dataType.Text },
];

const getStaticFormElements = (subjectType) => {
  if (_.isEmpty(subjectType)) {
    return [];
  }
  switch (subjectType.type) {
    case SubjectTypeType.Person:
      return personStaticFormElements;
    case SubjectTypeType.Household:
      return householdStaticFormElements;
    case SubjectTypeType.User:
      return userStaticFormElements;
    default:
      return nonPersonStaticFormElements;
  }
};

const FormDetails = () => {
  const { uuid: formUUID } = useParams();
  const record = useRecordContext();
  const userInfo = useSelector((state) => state.app.userInfo);

  const [state, setState] = useState({
    form: {},
    identifierSources: [],
    groupSubjectTypes: [],
    name: "",
    timed: false,
    errorMsg: "",
    createFlag: true,
    activeTabIndex: 0,
    successAlert: false,
    defaultSnackbarStatus: true,
    detectBrowserCloseEvent: false,
    nameError: false,
    redirectToWorkflow: false,
    availableDataTypes: [],
  });
  const multiSelectFormElementsToTypeMap = new Map();
  const questionGroupFormElementsToRepeatableMap = new Map();

  const onUpdateFormName = useCallback((name) => {
    setState((prev) => ({ ...prev, name, detectBrowserCloseEvent: true }));
  }, []);

  const onTabHandleChange = useCallback((event, value) => {
    setState((prev) => ({ ...prev, activeTabIndex: value }));
  }, []);

  const getDefaultSnackbarStatus = useCallback((defaultSnackbarStatus) => {
    setState((prev) => ({ ...prev, defaultSnackbarStatus }));
  }, []);

  const setupBeforeUnloadListener = useCallback(() => {
    const handler = (ev) => {
      ev.preventDefault();
      if (state.detectBrowserCloseEvent) {
        ev.returnValue = "Are you sure you want to close?";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.detectBrowserCloseEvent]);

  const getForm = useCallback(async () => {
    try {
      const response = await http.get(`/forms/export?formUUID=${formUUID}`);
      const form = response.data;

      form.visitScheduleRule = form.visitScheduleRule || "";
      form.decisionRule = form.decisionRule || "";
      form.validationRule = form.validationRule || "";
      form.checklistsRule = form.checklistsRule || "";
      form.decisionExpand = false;
      form.visitScheduleExpand = false;
      form.validationExpand = false;
      form.checklistExpand = false;

      _.forEach(form.formElementGroups, (group) => {
        group.groupId = (group.groupId || group.name).replace(
          /[^a-zA-Z0-9]/g,
          "_",
        );
        group.expanded = false;
        group.error = false;
        group.formElements.forEach((fe) => {
          fe.expanded = false;
          fe.error = false;
          fe.showConceptLibrary = "chooseFromLibrary";
          let keyValueObject = {};

          fe.keyValues.map((keyValue) => {
            keyValueObject[keyValue.key] = keyValue.value;
            return keyValue;
          });

          if (
            ["Date", "Duration"].includes(fe.concept.dataType) &&
            !Object.keys(keyValueObject).includes("durationOptions")
          ) {
            keyValueObject.durationOptions = [];
          }
          if (
            fe.concept.dataType === "Coded" &&
            keyValueObject.ExcludedAnswers !== undefined
          ) {
            _.forEach(fe.concept.answers, (answer) => {
              if (
                keyValueObject.ExcludedAnswers.includes(answer.name) &&
                !answer.voided
              ) {
                answer.excluded = true;
              }
            });
          }

          if (
            _.includes(
              multiSelectFormElementConceptDataTypes,
              fe.concept.dataType,
            )
          ) {
            multiSelectFormElementsToTypeMap.set(fe.uuid, fe.type);
          }
          if (fe.concept.dataType === "QuestionGroup") {
            questionGroupFormElementsToRepeatableMap.set(
              fe.uuid,
              keyValueObject.repeatable,
            );
          }
          fe.keyValues = keyValueObject;
        });
      });

      const dataGroupFlag = countGroupElements(form);
      setState((prev) => ({
        ...prev,
        form,
        name: form.name,
        timed: form.timed,
        createFlag: dataGroupFlag,
        formType: form.formType,
        subjectType: form.subjectType,
        disableForm: form.organisationId === 1,
        dataLoaded: true,
      }));

      if (dataGroupFlag) {
        btnGroupClick();
      }
    } catch (error) {
      setState((prev) => ({ ...prev, errorMsg: "Failed to load form data" }));
    }
  }, [formUUID]);

  const countGroupElements = useCallback((form) => {
    return _.every(
      form.formElementGroups,
      (groupElement) => groupElement.voided,
    );
  }, []);

  const reOrderSequence = useCallback((form, index = -1) => {
    if (index <= -1) {
      _.forEach(form.formElementGroups, (group, ind) => {
        group.displayOrder = ind + 1;
      });
    } else {
      _.forEach(form.formElementGroups[index].formElements, (element, ind) => {
        element.displayOrder = ind + 1;
      });
    }
  }, []);

  const deleteGroup = useCallback((index, elementIndex = -1) => {
    setState(
      produce((draft) => {
        if (elementIndex === -1) {
          formDesignerDeleteGroup(draft, draft.form.formElementGroups, index);
        } else {
          formDesignerDeleteFormElement(
            draft,
            draft.form.formElementGroups[index].formElements,
            elementIndex,
          );
        }
      }),
    );
  }, []);

  const handleRegex = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleRegex(
            draft.form.formElementGroups[index].formElements[elementIndex],
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const handleModeForDate = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleModeForDate(
            draft.form.formElementGroups[index].formElements[elementIndex],
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const updateConceptElementData = useCallback(
    (index, propertyName, value, elementIndex = -1) => {
      setState(
        produce((draft) => {
          formDesignerUpdateConceptElementData(
            draft.form.formElementGroups[index].formElements[elementIndex],
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const updateSkipLogicRule = useCallback((index, elementIndex, value) => {
    setState(
      produce((draft) => {
        formDesignerHandleGroupElementChange(
          draft,
          draft.form.formElementGroups[index],
          "rule",
          value,
          elementIndex,
        );
      }),
    );
  }, []);

  const updateSkipLogicJSON = useCallback((index, elementIndex, value) => {
    setState(
      produce((draft) => {
        formDesignerHandleGroupElementChange(
          draft,
          draft.form.formElementGroups[index],
          "declarativeRule",
          value,
          elementIndex,
        );
      }),
    );
  }, []);

  const updateFormElementGroupRule = useCallback((index, value) => {
    setState(
      produce((draft) => {
        formDesignerHandleGroupElementChange(
          draft,
          draft.form.formElementGroups[index],
          "rule",
          value,
          -1,
        );
      }),
    );
  }, []);

  const updateFormElementGroupRuleJSON = useCallback((index, value) => {
    setState(
      produce((draft) => {
        formDesignerHandleGroupElementChange(
          draft,
          draft.form.formElementGroups[index],
          "declarativeRule",
          value,
          -1,
        );
      }),
    );
  }, []);

  const onUpdateDragDropOrder = useCallback(
    (
      groupSourceIndex,
      sourceElementIndex,
      destinationElementIndex,
      groupOrElement = 1,
      groupDestinationIndex,
    ) => {
      setState(
        produce((draft) => {
          if (groupOrElement === 1) {
            const sourceElement =
              draft.form.formElementGroups[groupSourceIndex].formElements[
                sourceElementIndex
              ];
            const destinationElement =
              draft.form.formElementGroups[groupDestinationIndex].formElements[
                destinationElementIndex
              ];
            sourceElement.parentFormElementUuid =
              destinationElement.parentFormElementUuid;
            formDesignerUpdateDragDropOrderForFirstGroup(
              draft,
              draft.form.formElementGroups[groupSourceIndex],
              draft.form.formElementGroups[groupDestinationIndex],
              groupSourceIndex,
              groupDestinationIndex,
              sourceElementIndex,
              destinationElementIndex,
            );
          } else {
            let counter = 0;
            let form = draft.form;
            form.formElementGroups.forEach((element, index) => {
              if (!element.voided) {
                if (counter === destinationElementIndex) {
                  const sourceElement = form.formElementGroups.splice(
                    sourceElementIndex,
                    1,
                  )[0];
                  form.formElementGroups.splice(index, 0, sourceElement);
                }
                counter += 1;
              }
            });
            draft.detectBrowserCloseEvent = true;
          }
        }),
      );
    },
    [],
  );

  const getEntityNameForRules = useCallback(() => {
    const entityFormInfo = FormTypeEntities[state.form.formType];
    return entityFormInfo ? entityFormInfo.ruleVariableName : "";
  }, [state.form.formType]);

  const renderGroups = useCallback(() => {
    const formElements = [];
    _.forEach(state.form.formElementGroups, (group, index) => {
      if (!group.voided) {
        const propsGroup = {
          updateConceptElementData,
          key: `Group${index}`,
          groupData: group,
          index,
          deleteGroup,
          btnGroupAdd,
          identifierSources: state.identifierSources,
          groupSubjectTypes: state.groupSubjectTypes,
          onUpdateDragDropOrder,
          handleGroupElementChange,
          handleGroupElementKeyValueChange,
          handleExcludedAnswers,
          updateSkipLogicRule,
          updateSkipLogicJSON,
          updateFormElementGroupRuleJSON,
          handleModeForDate,
          handleRegex,
          handleConceptFormLibrary,
          onSaveInlineConcept,
          handleInlineNumericAttributes,
          handleInlineCodedConceptAnswers,
          onToggleInlineConceptCodedAnswerAttribute,
          onDeleteInlineConceptCodedAnswerDelete,
          onMoveUp,
          onMoveDown,
          onAlphabeticalSort,
          handleInlineCodedAnswerAddition,
          handleInlineLocationAttributes,
          handleInlineSubjectAttributes,
          handleInlineEncounterAttributes,
          handleInlinePhoneNumberAttributes,
          updateFormElementGroupRule,
          entityName: getEntityNameForRules(),
          disableGroup: state.disableForm,
          subjectType: state.subjectType,
          form: state.form,
        };
        formElements.push(<FormElementGroup {...propsGroup} />);
      }
    });
    return formElements;
  }, [
    state.form.formElementGroups,
    state.identifierSources,
    state.groupSubjectTypes,
    state.disableForm,
    state.subjectType,
    state.form,
  ]);

  const handleExcludedAnswers = useCallback(
    (name, status, index, elementIndex) => {
      setState(
        produce((draft) =>
          formDesignerHandleExcludedAnswers(
            draft,
            draft.form.formElementGroups[index].formElements[elementIndex],
            name,
            status,
          ),
        ),
      );
    },
    [],
  );

  const handleConceptFormLibrary = useCallback(
    (index, value, elementIndex, inlineConcept = false) => {
      setState(
        produce((draft) => {
          formDesignerHandleConceptFormLibrary(
            draft.form.formElementGroups[index].formElements[elementIndex],
            value,
            inlineConcept,
          );
        }),
      );
    },
    [],
  );

  const handleGroupElementKeyValueChange = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) =>
          formDesignerHandleGroupElementKeyValueChange(
            draft,
            draft.form.formElementGroups[index].formElements[elementIndex],
            propertyName,
            value,
          ),
        ),
      );
    },
    [],
  );

  const handleGroupElementChange = useCallback(
    (index, propertyName, value, elementIndex = -1) => {
      setState(
        produce((draft) =>
          formDesignerHandleGroupElementChange(
            draft,
            draft.form.formElementGroups[index],
            propertyName,
            value,
            elementIndex,
          ),
        ),
      );
    },
    [],
  );

  const handleInlineNumericAttributes = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleInlineNumericAttributes(
            draft.form.formElementGroups[index].formElements[elementIndex],
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const handleInlineCodedConceptAnswers = useCallback(
    (answerName, groupIndex, elementIndex, answerIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleInlineCodedConceptAnswers(
            draft.form.formElementGroups[groupIndex].formElements[elementIndex],
            answerName,
            answerIndex,
          );
        }),
      );
    },
    [],
  );

  const handleInlineCodedAnswerAddition = useCallback(
    (groupIndex, elementIndex) => {
      setState(
        produce((draft) =>
          formDesignerHandleInlineCodedAnswerAddition(
            draft.form.formElementGroups[groupIndex].formElements[elementIndex],
          ),
        ),
      );
    },
    [],
  );

  const onToggleInlineConceptCodedAnswerAttribute = useCallback(
    (propertyName, groupIndex, elementIndex, answerIndex) => {
      setState(
        produce((draft) => {
          formDesignerOnToggleInlineConceptCodedAnswerAttribute(
            draft.form.formElementGroups[groupIndex].formElements[elementIndex],
            propertyName,
            answerIndex,
          );
        }),
      );
    },
    [],
  );

  const onDeleteInlineConceptCodedAnswerDelete = useCallback(
    (groupIndex, elementIndex, answerIndex) => {
      setState(
        produce((draft) => {
          formDesignerOnDeleteInlineConceptCodedAnswerDelete(
            draft.form.formElementGroups[groupIndex].formElements[elementIndex],
            answerIndex,
          );
        }),
      );
    },
    [],
  );

  const onMoveUp = useCallback((groupIndex, elementIndex, answerIndex) => {
    setState(
      produce((draft) => {
        formDesignerOnConceptAnswerMoveUp(
          draft.form.formElementGroups[groupIndex].formElements[elementIndex],
          answerIndex,
        );
      }),
    );
  }, []);

  const onMoveDown = useCallback((groupIndex, elementIndex, answerIndex) => {
    setState(
      produce((draft) => {
        formDesignerOnConceptAnswerMoveDown(
          draft.form.formElementGroups[groupIndex].formElements[elementIndex],
          answerIndex,
        );
      }),
    );
  }, []);

  const onAlphabeticalSort = useCallback((groupIndex, elementIndex) => {
    setState(
      produce((draft) =>
        formDesignerOnConceptAnswerAlphabeticalSort(
          draft.form.formElementGroups[groupIndex].formElements[elementIndex],
        ),
      ),
    );
  }, []);

  const handleInlineLocationAttributes = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleInlineConceptAttributes(
            draft.form.formElementGroups[index].formElements[elementIndex],
            "inlineLocationDataTypeKeyValues",
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const handleInlineSubjectAttributes = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleInlineConceptAttributes(
            draft.form.formElementGroups[index].formElements[elementIndex],
            "inlineSubjectDataTypeKeyValues",
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const handleInlineEncounterAttributes = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleInlineConceptAttributes(
            draft.form.formElementGroups[index].formElements[elementIndex],
            "inlineEncounterDataTypeKeyValues",
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const handleInlinePhoneNumberAttributes = useCallback(
    (index, propertyName, value, elementIndex) => {
      setState(
        produce((draft) => {
          formDesignerHandleInlineConceptAttributes(
            draft.form.formElementGroups[index].formElements[elementIndex],
            "inlinePhoneNumberDataTypeKeyValues",
            propertyName,
            value,
          );
        }),
      );
    },
    [],
  );

  const btnGroupAdd = useCallback((index, elementIndex = -1) => {
    setState(
      produce((draft) => {
        if (elementIndex === -1) {
          formDesignerAddFormElementGroup(
            draft,
            draft.form.formElementGroups,
            index,
          );
        } else {
          formDesignerAddFormElement(
            draft,
            draft.form.formElementGroups[index].formElements,
            elementIndex,
          );
        }
      }),
    );
  }, []);

  const btnGroupClick = useCallback(() => {
    btnGroupAdd(0);
    setState((prev) => ({ ...prev, createFlag: false }));
  }, [btnGroupAdd]);

  const getDeclarativeRuleValidationError = useCallback((declarativeRule) => {
    const declarativeRuleHolder =
      DeclarativeRuleHolder.fromResource(declarativeRule);
    const validationError = declarativeRuleHolder.validateAndGetError();
    return { declarativeRuleHolder, validationError };
  }, []);

  const getDisallowedChangesError = useCallback((formElement) => {
    const currentType = multiSelectFormElementsToTypeMap.get(formElement.uuid);
    const currentRepeatability = questionGroupFormElementsToRepeatableMap.get(
      formElement.uuid,
    );
    return (
      (multiSelectFormElementsToTypeMap.has(formElement.uuid) &&
        !!currentType !== !!formElement.type) ||
      (questionGroupFormElementsToRepeatableMap.has(formElement.uuid) &&
        !!currentRepeatability !== !!formElement.keyValues.repeatable)
    );
  }, []);

  const validateFormLevelRules = useCallback(
    (form, declarativeRule, ruleKey, generateRuleFuncName) => {
      const { declarativeRuleHolder, validationError } =
        getDeclarativeRuleValidationError(declarativeRule);
      if (!_.isEmpty(validationError)) {
        form.ruleError[ruleKey] = validationError;
        return true;
      } else if (!declarativeRuleHolder.isEmpty()) {
        form[ruleKey] = declarativeRuleHolder[generateRuleFuncName](
          getEntityNameForRules(),
        );
      }
      return false;
    },
    [getDeclarativeRuleValidationError, getEntityNameForRules],
  );

  const validateForm = useCallback(() => {
    let flag = false;
    let errormsg = "";
    let numberGroupError = 0;
    let numberElementError = 0;

    setState(
      produce((draft) => {
        draft.nameError = draft.name === "";
        draft.form.ruleError = {};
        const {
          validationDeclarativeRule,
          decisionDeclarativeRule,
          visitScheduleDeclarativeRule,
        } = draft.form;
        const isValidationError = validateFormLevelRules(
          draft.form,
          validationDeclarativeRule,
          "validationRule",
          "generateFormValidationRule",
        );
        const isDecisionError = validateFormLevelRules(
          draft.form,
          decisionDeclarativeRule,
          "decisionRule",
          "generateDecisionRule",
        );
        const isVisitScheduleError = validateFormLevelRules(
          draft.form,
          visitScheduleDeclarativeRule,
          "visitScheduleRule",
          "generateVisitScheduleRule",
        );
        flag =
          isValidationError ||
          isDecisionError ||
          isVisitScheduleError ||
          draft.nameError;
        _.forEach(draft.form.formElementGroups, (group) => {
          group.errorMessage = {};
          group.error = false;
          group.expanded = false;
          const { declarativeRuleHolder, validationError } =
            getDeclarativeRuleValidationError(group.declarativeRule);
          const isGroupNameEmpty = group.name.trim() === "";
          if (
            !group.voided &&
            (isGroupNameEmpty || !_.isEmpty(validationError))
          ) {
            group.error = true;
            flag = true;
            numberGroupError += 1;
            if (isGroupNameEmpty) group.errorMessage.name = true;
            if (!_.isEmpty(validationError))
              group.errorMessage.ruleError = validationError;
          } else if (!declarativeRuleHolder.isEmpty()) {
            group.rule = declarativeRuleHolder.generateFormElementGroupRule(
              getEntityNameForRules(),
            );
          }
          let groupError = false;
          group.formElements.forEach((fe) => {
            fe.errorMessage = {};
            fe.error = false;
            fe.expanded = false;
            if (fe.errorMessage) {
              Object.keys(fe.errorMessage).forEach((key) => {
                fe.errorMessage[key] = false;
              });
            }
            const { declarativeRuleHolder, validationError } =
              getDeclarativeRuleValidationError(fe.declarativeRule);
            const disallowedChangeError = getDisallowedChangesError(fe);
            if (
              !fe.voided &&
              (fe.name === "" ||
                fe.concept.dataType === "" ||
                fe.concept.dataType === "NA" ||
                (fe.concept.dataType === "Coded" && fe.type === "") ||
                (fe.concept.dataType === "Video" &&
                  parseInt(fe.keyValues.durationLimitInSecs) < 0) ||
                (fe.concept.dataType === "Image" &&
                  parseInt(fe.keyValues.maxHeight) < 0) ||
                (fe.concept.dataType === "Image" &&
                  parseInt(fe.keyValues.maxWidth) < 0) ||
                !areValidFormatValuesValid(fe) ||
                !_.isEmpty(validationError) ||
                disallowedChangeError)
            ) {
              numberElementError += 1;
              fe.error = true;
              fe.expanded = true;
              flag = groupError = true;
              if (fe.name === "") fe.errorMessage.name = true;
              if (fe.concept.dataType === "") fe.errorMessage.concept = true;
              if (fe.concept.dataType === "Coded" && fe.type === "")
                fe.errorMessage.type = true;
              if (
                fe.concept.dataType === "Video" &&
                parseInt(fe.keyValues.durationLimitInSecs) < 0
              )
                fe.errorMessage.durationLimitInSecs = true;
              if (
                fe.concept.dataType === "Image" &&
                parseInt(fe.keyValues.maxHeight) < 0
              )
                fe.errorMessage.maxHeight = true;
              if (
                fe.concept.dataType === "Image" &&
                parseInt(fe.keyValues.maxWidth) < 0
              )
                fe.errorMessage.maxWidth = true;
              if (!areValidFormatValuesValid(fe))
                fe.errorMessage.validFormat = true;
              if (!_.isEmpty(validationError)) {
                fe.errorMessage.ruleError = validationError;
              }
              if (disallowedChangeError) {
                fe.errorMessage.disallowedChangeError = true;
              }
            } else if (
              !fe.voided &&
              fe.concept.dataType === "Duration" &&
              (!fe.keyValues.durationOptions ||
                fe.keyValues.durationOptions.length === 0)
            ) {
              fe.error = true;
              fe.expanded = true;
              fe.errorMessage.durationOptions = true;
              flag = groupError = true;
              numberElementError += 1;
            } else if (!declarativeRuleHolder.isEmpty()) {
              fe.rule = declarativeRuleHolder.generateViewFilterRule(
                getEntityNameForRules(),
              );
            }
          });
          if (groupError || group.error) {
            group.expanded = true;
          }
        });
        if (flag) {
          if (numberGroupError !== 0) {
            errormsg += `There is an error in ${numberGroupError} form group`;
            if (numberElementError !== 0)
              errormsg += ` and ${numberElementError} form element.`;
          } else if (numberElementError !== 0)
            errormsg += `There is an error in ${numberElementError} form element.`;
        }
        draft.errorMsg = errormsg;
        // Store the validation result in the draft to trigger useEffect
        draft.shouldCallUpdateForm = !flag;
      }),
    );
  }, [
    getDeclarativeRuleValidationError,
    getDisallowedChangesError,
    getEntityNameForRules,
  ]);

  const updateForm = useCallback(async () => {
    let dataSend = cloneDeep(state.form);
    dataSend.name = state.name;
    dataSend.timed = state.timed;
    _.forEach(dataSend.formElementGroups, (group) => {
      _.forEach(group.formElements, (element) => {
        if (element.concept.dataType === "Coded") {
          const excluded = element.concept.answers
            .map((answer) => answer.excluded && !answer.voided && answer.name)
            .filter((obj) => obj);
          if (!isEmpty(excluded)) {
            element.keyValues.ExcludedAnswers = excluded;
          } else if (element.keyValues.ExcludedAnswers) {
            delete element.keyValues.ExcludedAnswers;
          }
        }
        if (
          element.concept.dataType === "Video" &&
          element.keyValues.durationLimitInSecs === ""
        ) {
          delete element.keyValues.durationLimitInSecs;
        }
        if (
          (element.concept.dataType === "Date" ||
            element.concept.dataType === "Duration") &&
          element.keyValues.durationOptions?.length === 0
        ) {
          delete element.keyValues.durationOptions;
        }
        if (element.concept.dataType === "Image") {
          if (element.keyValues.maxHeight === "")
            delete element.keyValues.maxHeight;
          if (element.keyValues.maxWidth === "")
            delete element.keyValues.maxWidth;
        }
        if (
          element.validFormat &&
          isEmpty(element.validFormat.regex) &&
          isEmpty(element.validFormat.descriptionKey)
        ) {
          delete element.validFormat;
        }
        if (Object.keys(element.keyValues).length !== 0) {
          element.keyValues = Object.keys(element.keyValues).map((key) => ({
            key,
            value: element.keyValues[key],
          }));
        } else {
          element.keyValues = [];
        }
      });
    });
    reOrderSequence(dataSend);
    _.forEach(dataSend.formElementGroups, (group, index) => {
      reOrderSequence(dataSend, index);
    });
    try {
      const response = await http.post("/forms", dataSend);
      if (response.status === 200) {
        setState((prev) => ({
          ...prev,
          redirectToWorkflow: true,
          successAlert: true,
          defaultSnackbarStatus: true,
          detectBrowserCloseEvent: false,
        }));
        await getForm();
      }
    } catch (error) {
      const errorMessage = split(
        replace(error.response.data, /^org\..*: /, ""),
        /\n|\r/,
        1,
      );
      setState((prev) => ({
        ...prev,
        errorMsg: `Server error received: ${errorMessage}`,
      }));
    }
  }, [state.form, state.name, state.timed, reOrderSequence, getForm]);

  useEffect(() => {
    if (state.shouldCallUpdateForm) {
      updateForm();
      // Reset the flag to prevent repeated calls
      setState((prev) => ({ ...prev, shouldCallUpdateForm: false }));
    }
  }, [state.shouldCallUpdateForm, updateForm]);

  const onDragEnd = useCallback(
    (result) => {
      const { destination, source } = result;
      if (
        !destination ||
        (destination.droppableId === source.droppableId &&
          destination.index === source.index)
      ) {
        return;
      }
      if (result.type === "task") {
        const sourceGroupUuid = result.source.droppableId.replace("Group", "");
        const destGroupUuid = result.destination.droppableId.replace(
          "Group",
          "",
        );
        const groupSourceIndex = state.form.formElementGroups.findIndex(
          (g) => g.uuid === sourceGroupUuid,
        );
        const groupDestinationIndex = state.form.formElementGroups.findIndex(
          (g) => g.uuid === destGroupUuid,
        );
        if (groupSourceIndex === -1 || groupDestinationIndex === -1) return;
        const elementUuid = result.draggableId.split("Element")[1];
        const sourceElementIndex = state.form.formElementGroups[
          groupSourceIndex
        ].formElements.findIndex((fe) => fe.uuid === elementUuid);
        const destinationElementIndex = result.destination.index;
        if (sourceElementIndex === -1) return;
        onUpdateDragDropOrder(
          groupSourceIndex,
          sourceElementIndex,
          destinationElementIndex,
          1,
          groupDestinationIndex,
        );
      } else {
        const groupUuid = result.draggableId.replace("Group", "");
        const sourceElementIndex = state.form.formElementGroups.findIndex(
          (g) => g.uuid === groupUuid,
        );
        const destinationElementIndex = result.destination.index;
        if (sourceElementIndex === -1) return;
        onUpdateDragDropOrder(
          null,
          sourceElementIndex,
          destinationElementIndex,
          0,
          null,
        );
      }
    },
    [state.form.formElementGroups, onUpdateDragDropOrder],
  );

  const onRuleUpdate = useCallback((name, value) => {
    setState(
      produce((draft) => {
        draft.form[name] = value;
        draft.detectBrowserCloseEvent = true;
      }),
    );
  }, []);

  const onDeclarativeRuleUpdate = useCallback((ruleName, json) => {
    setState(
      produce((draft) => {
        draft.form[ruleName] = json;
        draft.detectBrowserCloseEvent = true;
      }),
    );
  }, []);

  const onDecisionConceptsUpdate = useCallback((decisionConcepts) => {
    setState(
      produce((draft) => {
        draft.form.decisionConcepts = decisionConcepts;
        draft.detectBrowserCloseEvent = true;
      }),
    );
  }, []);

  const onSaveInlineConcept = useCallback(
    (groupIndex, elementIndex) => {
      let clonedForm = cloneDeep(state.form);
      let clonedFormElement =
        clonedForm.formElementGroups[groupIndex].formElements[elementIndex];
      formDesignerOnSaveInlineConcept(clonedFormElement, () =>
        setState((prev) => ({ ...prev, form: clonedForm })),
      );
    },
    [state.form],
  );

  const onToggleExpandPanel = useCallback((name) => {
    setState(
      produce((draft) => {
        draft.form[name] = !draft.form[name];
      }),
    );
  }, []);

  useEffect(() => {
    setupBeforeUnloadListener();
    const transformIdentifierSources = (identifierSourcesFromServer) =>
      _.map(identifierSourcesFromServer, (source) => ({
        value: source.uuid,
        label: source.name,
      }));

    const fetchData = async () => {
      try {
        const identifierResponse = await http.get(`/web/identifierSource`);
        const identifierData = _.get(
          identifierResponse,
          "data._embedded.identifierSource",
          [],
        );
        setState((prev) => ({
          ...prev,
          identifierSources: transformIdentifierSources(identifierData),
        }));

        const operationalModules = await http
          .fetchJson("/web/operationalModules/")
          .then((res) => res.json);
        const groupSubjectTypes = _.filter(
          operationalModules.subjectTypes,
          (st) => !!st.group,
        );
        setState((prev) => ({
          ...prev,
          groupSubjectTypes,
          encounterTypes: operationalModules.encounterTypes,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          errorMsg: "Failed to load initial data",
        }));
      }
      await getForm();
    };

    fetchData();
  }, [getForm]);

  const hasFormEditPrivilege = UserInfo.hasFormEditPrivilege(
    userInfo,
    state.formType,
  );
  const form = (
    <Grid container>
      <Grid
        container
        sx={{
          alignContent: "flex-end",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Grid size={{ sm: 10 }}>
          {state.nameError && (
            <FormHelperText error>Form name is empty</FormHelperText>
          )}
          <TextField
            type="string"
            id="name"
            label="Form name"
            placeholder="Enter form name"
            margin="normal"
            onChange={(event) => onUpdateFormName(event.target.value)}
            value={state.name}
            autoComplete="off"
            disabled={state.disableForm}
          />
        </Grid>
        {state.createFlag && (
          <Grid size={{ sm: 2 }}>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={btnGroupClick}
              style={{ marginTop: "30px", marginBottom: "2px" }}
              disabled={state.disableForm}
            >
              Add Group
            </Button>
          </Grid>
        )}
        {hasFormEditPrivilege && !state.createFlag && (
          <Grid size={{ sm: 2 }}>
            <SaveComponent
              name="Save"
              onSubmit={validateForm}
              styles={{
                marginTop: "30px",
                marginBottom: "2px",
                marginLeft: "80px",
              }}
              disabledFlag={!state.detectBrowserCloseEvent || state.disableForm}
            />
          </Grid>
        )}
        {!hasFormEditPrivilege && (
          <div
            style={{
              backgroundColor: "salmon",
              borderColor: "red",
              margin: "20px",
              padding: "15px",
              fontSize: 24,
              borderRadius: "5px",
            }}
          >
            You do not have access to edit this form. Changes will not be saved
          </div>
        )}
      </Grid>
      <Grid size={{ sm: 12 }}>
        <Tabs
          style={{ background: "#2196f3", color: "white" }}
          value={state.activeTabIndex}
          onChange={onTabHandleChange}
          sx={{
            "& .MuiTabs-indicator": {
              backgroundColor: "#fff",
            },
          }}
        >
          <Tab
            label="Details"
            sx={{
              color: "#fff",
              "&.Mui-selected": {
                color: "#fff",
              },
            }}
          />
          <Tab
            label="Rules"
            sx={{
              color: "#fff",
              "&.Mui-selected": {
                color: "#fff",
              },
            }}
          />
        </Tabs>
        <TabContainer hidden={state.activeTabIndex !== 0}>
          <Grid container size={{ sm: 12 }}>
            <Grid size={{ sm: 12 }}>
              {state.errorMsg !== "" && (
                <FormControl fullWidth margin="dense">
                  <li style={{ color: "red" }}>{state.errorMsg}</li>
                </FormControl>
              )}
            </Grid>
          </Grid>
          {state.formType === "IndividualProfile" &&
            !_.isEmpty(getStaticFormElements(state.subjectType)) && (
              <div style={{ marginBottom: 30 }}>
                <StaticFormElementGroup
                  name={"First page questions (non editable)"}
                  formElements={getStaticFormElements(state.subjectType)}
                />
              </div>
            )}
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable
              droppableId="all-columns"
              direction="vertical"
              type="row"
            >
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {renderGroups()}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <SystemInfo {...state.form} direction={"row"} />
        </TabContainer>
        <div hidden={state.activeTabIndex !== 1}>
          <FormLevelRules
            form={state.form}
            onRuleUpdate={onRuleUpdate}
            onDeclarativeRuleUpdate={onDeclarativeRuleUpdate}
            onDecisionConceptsUpdate={onDecisionConceptsUpdate}
            onToggleExpandPanel={onToggleExpandPanel}
            entityName={getEntityNameForRules()}
            disabled={state.disableForm}
            encounterTypes={state.encounterTypes}
          />
        </div>
      </Grid>
    </Grid>
  );

  const redirectTo = record?.stateName;

  return (
    <FormDesignerContext.Provider value={{ setState, state }}>
      <Box sx={{ boxShadow: 2, p: 3, bgcolor: "background.paper" }}>
        <Title title="Form Details" />
        {state.dataLoaded ? form : <div>Loading</div>}
        {state.redirectToWorkflow && redirectTo && (
          <Navigate to={`/appdesigner/${redirectTo}`} />
        )}
        {state.successAlert && (
          <CustomizedSnackbar
            message="Successfully updated the form"
            getDefaultSnackbarStatus={getDefaultSnackbarStatus}
            defaultSnackbarStatus={state.defaultSnackbarStatus}
          />
        )}
      </Box>
    </FormDesignerContext.Provider>
  );
};

export default FormDetails;
