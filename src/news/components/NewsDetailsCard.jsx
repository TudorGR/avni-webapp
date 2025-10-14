import { Fragment } from "react";
import { Box, Typography, Button, Divider, Grid } from "@mui/material";
import { getFormattedDateTime } from "../../adminApp/components/AuditUtil";
import { Delete, Edit } from "@mui/icons-material";
import { ActionButton } from "./ActionButton";
import { isNil } from "lodash";
import { AvniMediaUpload } from "../../common/components/AvniMediaUpload";
import DOMPurify from "dompurify";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import UserInfo from "../../common/model/UserInfo";
import { Privilege } from "openchs-models";

const NewsDetailsCard = ({
  news,
  setDeleteAlert,
  setOpenEdit,
  setPublishAlert,
  displayActions,
}) => {
  const navigate = useNavigate();
  const userInfo = useSelector((state) => state.app.userInfo);
  const canEditNews = UserInfo.hasPrivilege(
    userInfo,
    Privilege.PrivilegeType.EditNews,
  );

  return (
    <Fragment>
      <Grid
        container
        direction="row"
        sx={{
          alignItems: "center",
        }}
      >
        <Grid container direction={"column"} size={6}>
          <Grid>
            <Button
              color="primary"
              onClick={() => navigate(-1)}
              style={{ textTransform: "none", backgroundColor: "transparent" }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                {"< Back"}
              </Typography>
            </Button>
          </Grid>
          <Grid>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {news.title}
            </Typography>
          </Grid>
          <Grid>
            <Typography sx={{ opacity: 0.7 }} variant="body2">
              {getFormattedDateTime(news.createdDateTime)}
            </Typography>
          </Grid>
        </Grid>
        {displayActions && canEditNews && (
          <Grid
            container
            spacing={2}
            sx={{
              justifyContent: "flex-end",
            }}
            size={6}
          >
            <Grid>
              <Button
                style={{ color: "red" }}
                onClick={() => setDeleteAlert(true)}
              >
                <Delete /> Delete
              </Button>
            </Grid>
            <Grid>
              <Button
                color="primary"
                type="button"
                onClick={() => setOpenEdit(true)}
              >
                <Edit />
                Edit
              </Button>
            </Grid>
            <Grid>
              <ActionButton
                disabled={!isNil(news.publishedDate)}
                onClick={() => setPublishAlert(true)}
                variant="contained"
                style={{ paddingHorizontal: 10 }}
                size="medium"
              >
                {"Publish this news"}
              </ActionButton>
            </Grid>
          </Grid>
        )}
      </Grid>
      <Box
        sx={{
          mt: 2,
        }}
      />
      <Divider />
      <Box
        sx={{
          mt: 2,
        }}
      />
      <Grid container spacing={5} direction="column">
        <Grid align={"center"}>
          <AvniMediaUpload
            oldImgUrl={news.heroImage}
            height={"400"}
            width={"80%"}
            accept="image/*"
          />
        </Grid>
        <Grid
          container
          sx={{
            justifyContent: "flex-start",
          }}
        >
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(news.contentHtml),
            }}
          />
        </Grid>
      </Grid>
    </Fragment>
  );
};

export default NewsDetailsCard;
