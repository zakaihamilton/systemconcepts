import React from "react";
import { styled } from '@mui/material/styles';
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import Typography from "@mui/material/Typography";
import StepLabel from "@mui/material/StepLabel";
import StepConnector from "@mui/material/StepConnector";
import Button from "@mui/material/Button";
import clsx from "clsx";

const PREFIX = 'Stepper';

const classes = {
    alternativeLabel: `${PREFIX}-alternativeLabel`,
    disabled: `${PREFIX}-disabled`,
    completed: `${PREFIX}-completed`,
    line: `${PREFIX}-line`,
    root: `${PREFIX}-root`,
    button: `${PREFIX}-button`,
    actions: `${PREFIX}-actions`,
    icon: `${PREFIX}-icon`,
    active: `${PREFIX}-active`,
    completed2: `${PREFIX}-completed2`
};

const Root = styled('div')((
    {
        theme
    }
) => ({
    [`& .${classes.root}`]: {

    },

    [`& .${classes.button}`]: {
        marginRight: theme.spacing(1),
    },

    [`& .${classes.actions}`]: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
    },

    [`&.${classes.icon}`]: {
        backgroundColor: "#ccc",
        zIndex: 1,
        color: "#fff",
        width: 50,
        height: 50,
        display: "flex",
        borderRadius: "50%",
        justifyContent: "center",
        alignItems: "center",
    },

    [`&.${classes.active}`]: {
        backgroundImage: "linear-gradient( 136deg, rgb(242,113,33) 0%, rgb(233,64,87) 50%, rgb(138,35,135) 100%)",
        boxShadow: "0 4px 10px 0 rgba(0,0,0,.25)"
    },

    [`& .${classes.completed2}`]: {
        backgroundImage: "linear-gradient( 136deg, rgb(242,113,33) 0%, rgb(233,64,87) 50%, rgb(138,35,135) 100%)",
    }
}));

const Connector = StepConnector;

export default function StepperWidget({ className, steps, state, actions, ...props }) {

    const [stepId, setStepId] = state;
    steps = steps.filter(step => {
        if (typeof step.visible === "undefined") {
            return true;
        }
        return step.visible;
    });
    const stepIdx = steps.findIndex(step => step.id === stepId);

    const actionItems = actions.map(action => {
        let {title, visible} = action;
        if (typeof visible === "function") {
            visible = visible({ id: stepId, idx: stepIdx });
        }
        if (typeof title === "function") {
            title = title({ id: stepId, idx: stepIdx });
        }
        const onClick = () => {
            const idx = action.click({ id: stepId, idx: stepIdx });
            const step = steps[idx];
            if (step) {
                setStepId(step.id);
            }
        };
        return (
            (<Button
                key={action.id}
                variant="contained"
                color="primary"
                onClick={onClick}
                className={classes.button}
                style={{...(!visible && {visibility:"hidden"})}}
            >
                {title}
            </Button>)
        );
    });

    className = clsx(className, classes.root);

    function Icon({ active, completed, disabled, icon }) {

        const stepIdx = parseInt(icon) - 1;
        const step = steps[stepIdx];

        if (!step) {
            return null;
        }

        return (
            (<Root
                className={clsx(classes.icon, {
                    [classes.disabled]: disabled,
                    [classes.active]: active,
                    [classes.completed]: completed,
                    [classes.selected]: step.id === stepId
                })}
            >
                {step.icon}
            </Root>)
        );
    }

    return (
        (<div className={className} {...props}>
            <Stepper alternativeLabel nonLinear activeStep={stepIdx} connector={<Connector
                classes={{
                    alternativeLabel: classes.alternativeLabel,
                    disabled: classes.disabled,
                    completed: classes.completed,
                    line: classes.line
                }} />}>
                {steps.map((step, idx) => {
                    let { id, label, subLabel } = step;
                    const previousStep = steps[idx - 1];
                    const previousIsDisabled = previousStep && previousStep.disabled;
                    const disabled = step.disabled;
                    let completed = idx <= stepIdx;
                    let active = idx === stepIdx;
                    if (previousIsDisabled && completed && !disabled) {
                        active = true;
                        completed = false;
                    }
                    if (disabled) {
                        active = false;
                        completed = false;
                    }
                    const stepProps = { active, completed, disabled };
                    let style = {};
                    if(idx === stepIdx) {
                        style = {
                            fontWeight:"bold"
                        };
                    }
                    const stepLabelProps = { StepIconComponent: Icon };
                    return (
                        <Step key={id} {...stepProps}>
                            <StepLabel {...stepLabelProps}>
                                <Typography variant="body1" style={style}>
                                    {label}
                                </Typography>
                                <Typography variant="body2">
                                    {subLabel}
                                </Typography>
                            </StepLabel>
                        </Step>
                    );
                })}
            </Stepper>
            <div className={classes.actions}>
                {actionItems}
            </div>
        </div>)
    );
}
